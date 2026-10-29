import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { api, type Config } from "../../shared/api/ApiModel";
import { t } from "../../shared/i18n/i18n";
import { type MenuState } from "../../shared/ui/MenuModel";
import { type OpenFolder } from "../folders/FolderModel";

/**
 * `App` の、画面の外とのやりとり(起動時の読み込み・クリックでメニューを閉じる・フォルダが消えたら閉じる・ウィジェットからのフォルダの要求)。
 * @param config いまの設定
 * @param configRef 常に最新の設定
 * @param setConfig 設定を入れる関数(起動時の読み込みで使う)
 * @param setBgImage 背景画像を入れる関数
 * @param setAccent テーマカラーを入れる関数
 * @param setLauncherPath ホームのアイコンの保存先のパスを入れる関数
 * @param menu 開いている右クリックメニュー
 * @param setMenu 右クリックメニューを開く/閉じる
 * @param showSettings 設定を開いているか
 * @param setShowSettings 設定を開く/閉じる
 * @param open 開いているフォルダ
 * @param setOpen フォルダを開く/閉じる
 * @param flash 画面に一言出す関数
 */
export function useAppEffects({
  config,
  configRef,
  setConfig,
  setBgImage,
  setAccent,
  setLauncherPath,
  menu,
  setMenu,
  showSettings,
  setShowSettings,
  open,
  setOpen,
  flash,
}: {
  config: Config | null;
  configRef: MutableRefObject<Config | null>;
  setConfig: (c: Config) => void;
  setBgImage: (s: string | null) => void;
  setAccent: (c: string) => void;
  setLauncherPath: (p: string) => void;
  menu: MenuState | null;
  setMenu: Dispatch<SetStateAction<MenuState | null>>;
  showSettings: boolean;
  setShowSettings: Dispatch<SetStateAction<boolean>>;
  open: OpenFolder | null;
  setOpen: Dispatch<SetStateAction<OpenFolder | null>>;
  flash: (msg: string) => void;
}) {
  // 起動時: 設定を読み込む(背景画像・ホームの保存先・ショートカットの登録結果・テーマカラーも)
  useEffect(() => {
    api
      .loadConfig()
      .then((c) => {
        setConfig(c);
        if (c.settings?.theme === "image") api.loadBackground().then(setBgImage);
        api
          .getLauncherFolder()
          .then(setLauncherPath)
          .catch(() => {});
        // ショートカットが有効なのに他のアプリと衝突して登録できていなければ知らせる
        if (c.settings?.hotkeyEnabled ?? true) api.hotkeyRegistered().then((ok) => !ok && flash(t("hotkeyFailed")));
      })
      .catch(() => setConfig({ folders: [] }));
    api.getAccent().then((c) => c && setAccent(c));
  }, [flash, setConfig, setBgImage, setAccent, setLauncherPath]);

  // メニュー・設定は、外をクリックするか、ウィンドウが非アクティブになると閉じる
  useEffect(() => {
    if (!menu && !showSettings) return;
    const off = () => {
      setMenu(null);
      setShowSettings(false);
    };
    window.addEventListener("click", off);
    window.addEventListener("blur", off);
    return () => {
      window.removeEventListener("click", off);
      window.removeEventListener("blur", off);
    };
  }, [menu, showSettings, setMenu, setShowSettings]);

  // 開いているフォルダが一覧から無くなったとき(元に戻す/やり直しなど)は、フォルダ内の画面を閉じる
  useEffect(() => {
    if (open && config && !config.folders.some((f) => f.id === open.folder.id)) setOpen(null);
  }, [open, config, setOpen]);

  // ウィジェットから、フォルダを開く(ショートカットウィジェットのフォルダ)
  useEffect(() => {
    const onOpenFolder = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      const folder = configRef.current?.folders.find((f) => f.id === id);
      if (folder) setOpen({ folder, origin: { x: window.innerWidth / 2, y: window.innerHeight / 2 } });
      else flash(t("folderGone"));
    };
    window.addEventListener("alumi:open-folder-id", onOpenFolder);
    return () => window.removeEventListener("alumi:open-folder-id", onOpenFolder);
  }, [flash, configRef, setOpen]);
}
