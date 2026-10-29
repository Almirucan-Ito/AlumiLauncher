// アプリ全体: 設定の読み書き・プリセット・起動と終了・記録(ログ)・ショートカットキー・自動起動・テーマカラー
// `api`(ApiModel.ts)に、他の領域といっしょに、まとめて渡される。

import { invoke, isTauri } from "./ApiHelpers";
import { MOCK_CONFIG } from "./ApiMock";
import { type Config, DEFAULT_SETTINGS } from "./ApiTypes";

/** アプリ全体: 設定の読み書き・プリセット・起動と終了・記録(ログ)・ショートカットキー・自動起動・テーマカラー */
export const appApi = {
  /** 設定(いま表示するプリセットのフォルダ・並び順と、設定)を読む。 */
  async loadConfig(): Promise<Config> {
    if (!isTauri) return structuredClone(MOCK_CONFIG);
    return invoke<Config>("load_config");
  },
  /**
   * プリセットを使うか・どれを表示するかを変える。
   * @param enabled プリセットを使うか
   * @param preset 表示するプリセット番号
   * @param count プリセットの数(1〜9)
   * @returns 変更後に表示するフォルダ・並び順を含む設定
   */
  async setPresetMode(enabled: boolean, preset: number, count: number): Promise<Config> {
    if (!isTauri) {
      const n = enabled ? preset : 1;
      const base = structuredClone(MOCK_CONFIG);
      const folders = n === 1 ? base.folders : n === 2 ? [{ id: "21", name: "プリセット2", path: "mock/game" }] : [];
      return {
        ...base,
        folders,
        settings: { ...DEFAULT_SETTINGS, presetsEnabled: enabled, preset, presetCount: count },
      };
    }
    return invoke<Config>("set_preset_mode", { enabled, preset, count });
  },
  /**
   * 設定を保存する(Rust 側が検査して、少し待ってからファイルへ書く)。
   * @param config 保存する設定
   */
  async saveConfig(config: Config): Promise<void> {
    if (!isTauri) return;
    await invoke("save_config", { config });
  },
  /** アプリを終了する(トレイに常駐しているものも含めて、完全に終了) */
  async quitApp(): Promise<void> {
    if (!isTauri) return;
    await invoke("quit_app");
  },
  /**
   * 画面で起きた失敗を、記録(ログ)に書く。記録はこの PC の中だけに置く。
   * @param level 重さ
   * @param message 内容
   */
  async writeLog(level: "error" | "warn", message: string): Promise<void> {
    if (!isTauri) return console[level]("log", message);
    await invoke("write_log", { level, message }).catch(() => {});
  },
  /**
   * アプリのバージョン(`tauri.conf.json` の `version`)。バグの報告に添えてもらう。
   * @returns `1.0.0` のような文字列(ブラウザでの確認では `dev`)
   */
  async getVersion(): Promise<string> {
    if (!isTauri) return "dev";
    const { getVersion } = await import("@tauri-apps/api/app");
    return getVersion();
  },
  /**
   * 設定を保存できなかったときに呼ばれる関数を登録する(本体が、書き込みに失敗するたびに知らせる)。
   * @param cb 失敗の理由を受け取る関数
   * @returns 登録を解除する関数
   */
  async onSaveFailed(cb: (reason: string) => void): Promise<() => void> {
    if (!isTauri) return () => {};
    const { listen } = await import("@tauri-apps/api/event");
    return listen<string>("save-failed", (e) => cb(e.payload));
  },
  /** 起動時のアイコンの用意ができたことを知らせる(それまで、ウィンドウは出ない) */
  async appReady(): Promise<void> {
    if (!isTauri) return;
    try {
      await invoke("app_ready");
    } catch {
      /* 知らせられなくても、数秒後には出る */
    }
  },
  /** ショートカットが実際に登録できているか(他のアプリが同じ組み合わせを使っていると失敗する)。 */
  async hotkeyRegistered(): Promise<boolean> {
    if (!isTauri) return true;
    return invoke<boolean>("hotkey_registered");
  },
  /** Windows のテーマカラー(`#rrggbb`)を取得する。取得できなければ `null`。 */
  async getAccent(): Promise<string | null> {
    if (!isTauri) return "#0078d4";
    return invoke<string | null>("get_accent_color");
  },
  /** スタートアップ(Windows 起動時の自動起動)に登録されているか。 */
  async getAutostart(): Promise<boolean> {
    if (!isTauri) return false;
    return invoke<boolean>("get_autostart");
  },
  /**
   * スタートアップへの登録/解除。
   * @param enabled 登録するか
   * @returns 変更後の状態
   */
  async setAutostart(enabled: boolean): Promise<boolean> {
    if (!isTauri) return enabled;
    return invoke<boolean>("set_autostart", { enabled });
  },
  /**
   * ショートカットの組み合わせを変える。登録できなければ(他のアプリが使用中など)、元のままにする。
   * @param combo 新しい組み合わせ(例: `"Ctrl+Alt+L"`)
   * @param enabled ショートカットを有効にしているか
   * @returns 変えられたら `true`
   */
  async setHotkey(combo: string, enabled: boolean): Promise<boolean> {
    if (!isTauri) return true;
    return invoke<boolean>("set_hotkey", { combo, enabled });
  },
  /**
   * 常に最前面に表示するかを切り替える。
   * @param enabled 最前面にするか
   */
  async setAlwaysOnTop(enabled: boolean): Promise<void> {
    if (!isTauri) return;
    await invoke("set_always_on_top", { enabled });
  },
  /**
   * デスクトップモードを入れる/切る(入れると、最大化して、常に一番後ろに置く)。
   * @param enabled 入れるか
   */
  async setDesktopMode(enabled: boolean): Promise<void> {
    if (!isTauri) return;
    await invoke("set_desktop_mode", { enabled });
  },
  /**
   * ショートカットの登録/解除。
   * @param enabled 有効にするか
   * @returns 利用可能な状態か(有効にしたのに、他のアプリと衝突して登録できなければ `false`)
   */
  async setHotkeysEnabled(enabled: boolean): Promise<boolean> {
    if (!isTauri) return true;
    return invoke<boolean>("set_hotkeys_enabled", { enabled });
  },
};
