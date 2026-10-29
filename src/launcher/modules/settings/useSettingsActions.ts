import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { type Config, DEFAULT_SETTINGS, type Settings, api } from "../../shared/api/ApiModel";
import { t } from "../../shared/i18n/i18n";
import { type OpenFolder } from "../folders/FolderModel";
import { type MenuState } from "../../shared/ui/MenuModel";

/**
 * 設定の変更に関する操作と、見た目に関わる設定の状態(Windows のテーマカラー・背景画像・スタートアップ)をまとめる。
 *
 * @param config 画面に出している設定(読み込み前は `null`)
 * @param settings 画面が使う設定(足りない項目は、初期値で補ってある)
 * @param configRef 常に最新の設定
 * @param setConfig 画面の設定だけを置き換える(プリセットの切り替えで、Rust 側が作り直した設定を受け取る)
 * @param mutate 最新の設定に変更を適用して保存する関数
 * @param flash 画面に一言出す関数
 * @param reloadAll アイコンと一覧を読み直す関数
 * @param flushReorder まとめていた並べ替えを、履歴へ確定する関数
 * @param clearHistory 元に戻す履歴を、全部捨てる関数
 * @param setOpen 開いているフォルダを、変える関数
 * @param setMenu 右クリックメニューを、変える関数
 * @param setLauncherPath ホームのアイコンの保存先(launcherFolder)のパスを、変える関数
 * @param showSettings 設定を開いているか(開いたときに、スタートアップの状態を読む)
 * @returns 状態(`accent`・`bgImage`・`autostart`・`confirmReset`)と、操作(`changeSettings` ほか)
 */
export function useSettingsActions({
  config,
  settings,
  configRef,
  setConfig,
  mutate,
  flash,
  reloadAll,
  flushReorder,
  clearHistory,
  setOpen,
  setMenu,
  setLauncherPath,
  showSettings,
}: {
  config: Config | null;
  settings: Settings;
  configRef: { current: Config | null };
  setConfig: Dispatch<SetStateAction<Config | null>>;
  mutate: (fn: (c: Config) => Config) => void;
  flash: (msg: string) => void;
  reloadAll: (silent?: boolean) => void | Promise<void>;
  flushReorder: () => void;
  clearHistory: () => void;
  setOpen: Dispatch<SetStateAction<OpenFolder | null>>;
  setMenu: Dispatch<SetStateAction<MenuState | null>>;
  setLauncherPath: (path: string) => void;
  showSettings: boolean;
}) {
  /** Windows のテーマカラー(取れるまでは、既定の青)。 */
  const [accent, setAccent] = useState("#0078d4");
  /** 背景画像(表示用の URL。無ければ `null`)。 */
  const [bgImage, setBgImage] = useState<string | null>(null);

  /**
   * 設定を変えて保存する。あわせて、変わった項目に応じて、ショートカットの有効/無効・常に最前面・Web ミニアプリの音量・アイコンの取り直し(プレビューの切り替え)・テーマカラー・背景画像の読み込みを行う。
   * @param s 新しい設定
   */
  const changeSettings = (s: Settings) => {
    // デスクトップモードの切り替えは、ウィンドウの操作なので、画面の更新・保存より先に頼む(切ったあと、すぐ操作できるように)
    if (s.desktopMode !== settings.desktopMode) api.setDesktopMode(s.desktopMode);
    mutate((c) => ({ ...c, settings: s }));
    if (s.hotkeyEnabled !== settings.hotkeyEnabled) {
      api.setHotkeysEnabled(s.hotkeyEnabled).then((ok) => !ok && flash(t("hotkeyFailed")));
    }
    if (s.alwaysOnTop !== settings.alwaysOnTop) api.setAlwaysOnTop(s.alwaysOnTop);
    if (s.masterVolume !== settings.masterVolume) api.miniWebVolume(s.masterVolume); // 開いている Web ミニアプリへも反映
    // プレビューの表示を切り替えたら、アイコンを取り直す(保存が終わってから)
    if (s.previewThumbnails !== settings.previewThumbnails) setTimeout(() => reloadAll(true), 150);
    if (s.theme === "accent") api.getAccent().then((c) => c && setAccent(c));
    if (s.theme === "image" && !bgImage) api.loadBackground().then(setBgImage);
  };

  /**
   * ショートカットの組み合わせを変える。他のアプリが使っていて登録できなければ、元のままにして知らせる。
   * @param combo 新しい組み合わせ
   */
  const changeHotkey = async (combo: string) => {
    if (!config) return;
    try {
      if (await api.setHotkey(combo, settings.hotkeyEnabled)) {
        changeSettings({ ...settings, hotkey: combo });
        flash(t("hotkeySaved", { combo }));
      } else flash(t("hotkeyFailed"));
    } catch {
      flash(t("hotkeyInvalid"));
    }
  };

  /**
   * プリセットを切り替える(使うかどうかを変えるときも同じ)。表示するフォルダ・アイコンが入れ替わるので、開いているものと、元に戻す履歴は捨てる。
   * @param enabled プリセットを使うか
   * @param preset 表示するプリセット番号
   * @param count プリセットの数(省くと、いまの数)
   */
  const applyPresetMode = async (enabled: boolean, preset: number, count = settings.presetCount) => {
    flushReorder();
    try {
      const view = await api.setPresetMode(enabled, preset, count);
      clearHistory();
      configRef.current = view;
      setConfig(view);
      setOpen(null);
      setMenu(null);
      reloadAll(true);
      api
        .getLauncherFolder()
        .then(setLauncherPath)
        .catch(() => {});
    } catch (err) {
      flash(String(err));
    }
  };

  /** 背景画像を選んで、取り込む(大きすぎる・対応していない形式なら、知らせる)。 */
  const pickImage = async () => {
    if (!config) return;
    const src = await api.pickImage(t("imageFilter"));
    if (!src) return;
    try {
      setBgImage(await api.importBackground(src));
      changeSettings({ ...settings, theme: "image" });
    } catch (err) {
      flash(String(err).includes("too_large") ? t("imageTooLarge") : t("imageUnsupported"));
    }
  };

  // スタートアップ(Windows 起動時の自動起動)。設定を開いたときに現在の状態を読む
  const [autostart, setAutostart] = useState(false);
  useEffect(() => {
    if (showSettings) api.getAutostart().then(setAutostart);
  }, [showSettings]);
  /**
   * スタートアップ(Windows 起動時の自動起動)の登録/解除。
   * @param enabled 登録するか
   */
  const changeAutostart = async (enabled: boolean) => {
    setAutostart(enabled);
    setAutostart(await api.setAutostart(enabled));
  };

  // 「デフォルト値にする」: 設定(ウィンドウサイズ・表示・背景・ドラッグ・ショートカット・スタートアップ)を初期値に戻す。
  // フォルダや並び順などのデータは変えない。誤操作を防ぐため、2回押して実行する
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => {
    if (!confirmReset) return;
    const id = setTimeout(() => setConfirmReset(false), 3000);
    return () => clearTimeout(id);
  }, [confirmReset]);
  /** 「デフォルト値にする」: 設定(ウィンドウサイズ・表示・背景・ドラッグ・ショートカット・スタートアップ)を初期値に戻す。フォルダや並び順などのデータは変えない。誤操作を防ぐため、2 回押して実行する。 */
  const resetSettings = async () => {
    if (!confirmReset) return setConfirmReset(true);
    setConfirmReset(false);
    // プリセットの選択は、設定の保存では変わらない(applyPresetMode でだけ変える)ので、初期値(使う・1)へは別に戻す
    changeSettings({
      ...DEFAULT_SETTINGS,
      preset: settings.preset,
      presetsEnabled: settings.presetsEnabled,
      presetCount: settings.presetCount,
    });
    if (!settings.presetsEnabled || settings.preset !== 1 || settings.presetCount !== 3) applyPresetMode(true, 1, 3);
    api.setWindowSize(DEFAULT_SETTINGS.width, DEFAULT_SETTINGS.height);
    changeAutostart(false);
    flash(t("resetDone"));
  };

  return {
    accent,
    setAccent,
    bgImage,
    setBgImage,
    changeSettings,
    changeHotkey,
    applyPresetMode,
    pickImage,
    autostart,
    changeAutostart,
    confirmReset,
    resetSettings,
  };
}
