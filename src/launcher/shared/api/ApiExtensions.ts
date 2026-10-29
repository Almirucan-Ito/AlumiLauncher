// ウィジェット・ミニアプリ: 一覧・取り込み・Web ミニアプリ・データとキャッシュ・フォルダを開く・スタートメニューのアプリ
// `api`(ApiModel.ts)に、他の領域といっしょに、まとめて渡される。

import { invoke, isTauri } from "./ApiHelpers";
import { MOCK_NAMES, MOCK_START_APPS, mockCache, mockMiniApps, mockMiniFiles, mockStore, mockWidgets } from "./ApiMock";
import {
  type Installed,
  type MiniApp,
  type ModWidget,
  type StartApp,
  type StorageKind,
  type StorageUsage,
} from "./ApiTypes";

/** ウィジェット・ミニアプリ: 一覧・取り込み・Web ミニアプリ・データとキャッシュ・フォルダを開く・スタートメニューのアプリ */
export const extensionsApi = {
  /** ウィジェットの一覧(widgets フォルダのものと、ミニアプリの中のもの。組み込みのウィジェットの定義を含む)を取得する。 */
  async listWidgets(): Promise<ModWidget[]> {
    if (!isTauri) return mockWidgets();
    return invoke<ModWidget[]>("list_widgets");
  },
  /** ミニアプリの一覧を取得する。 */
  async listMiniApps(): Promise<MiniApp[]> {
    if (!isTauri) return mockMiniApps();
    return invoke<MiniApp[]>("list_miniapps");
  },
  /**
   * ドロップされたフォルダのうち、ウィジェット・ミニアプリのものを取り込む。
   * @param paths ドロップされたフォルダのパス
   * @returns `installed` 取り込めたもの / `rest` それ以外(通常のフォルダなど)
   */
  async installExtensions(paths: string[]): Promise<{ installed: Installed[]; rest: string[] }> {
    if (!isTauri) return { installed: [], rest: paths };
    return invoke<{ installed: Installed[]; rest: string[] }>("install_extensions", { paths });
  },
  /**
   * Web ミニアプリを、ランチャーと同じ位置・大きさの別のウィンドウで開く(同意がなければ、`not_allowed` で失敗する)。
   * @param id ミニアプリのフォルダ名
   */
  async miniWebOpen(id: string): Promise<void> {
    if (!isTauri) return;
    return invoke<void>("mini_web_open", { id });
  },
  /**
   * Web ミニアプリのウィンドウが閉じられたときに呼ばれる関数を登録する。
   * @param cb 閉じられたときに呼ぶ関数
   * @returns 登録を解除する関数
   */
  async onMiniWebClosed(cb: () => void): Promise<() => void> {
    if (!isTauri) return () => {};
    const { listen } = await import("@tauri-apps/api/event");
    return listen("miniweb-closed", () => cb());
  },
  /** 開いている Web ミニアプリのウィンドウを閉じる。 */
  async miniWebClose(): Promise<void> {
    if (!isTauri) return;
    return invoke<void>("mini_web_close");
  },
  /**
   * 開いている Web ミニアプリの音量を、ランチャーの音量に合わせる。
   * @param percent 音量(0〜100)
   */
  async miniWebVolume(percent: number): Promise<void> {
    if (!isTauri) return;
    return invoke<void>("mini_web_volume", { percent });
  },
  /**
   * ウィジェット・ミニアプリのデータ(それぞれのフォルダの `data` フォルダ)を、すべて読む。
   * @param kind 種類
   * @param id フォルダ名
   * @returns キー → 値の表
   */
  async appDataLoad(kind: StorageKind, id: string): Promise<Record<string, string>> {
    if (!isTauri) return { ...(mockStore[`${kind}:${id}`] ?? {}) };
    return invoke<Record<string, string>>("app_data_load", { kind, id });
  },
  /**
   * データを 1 つ保存する。
   * @param kind 種類
   * @param id フォルダ名
   * @param key キー
   * @param value 値
   */
  async appDataSet(kind: StorageKind, id: string, key: string, value: string): Promise<void> {
    if (!isTauri) {
      (mockStore[`${kind}:${id}`] ??= {})[key] = value;
      return;
    }
    return invoke<void>("app_data_set", { kind, id, key, value });
  },
  /**
   * キャッシュ(それぞれのフォルダの `cache` フォルダ)を 1 つ読む。
   * @returns 値。無ければ `null`
   */
  async appCacheGet(kind: StorageKind, id: string, key: string): Promise<string | null> {
    if (!isTauri) return mockCache[`${kind}:${id}/${key}`] ?? null;
    return invoke<string | null>("app_cache_get", { kind, id, key });
  },
  /** キャッシュを 1 つ保存する。 */
  async appCacheSet(kind: StorageKind, id: string, key: string, value: string): Promise<void> {
    if (!isTauri) {
      mockCache[`${kind}:${id}/${key}`] = value;
      return;
    }
    return invoke<void>("app_cache_set", { kind, id, key, value });
  },
  /** ウィジェット・ミニアプリごとの、データ・キャッシュの大きさを取得する。 */
  async appStorageInfo(): Promise<StorageUsage[]> {
    if (!isTauri) {
      return Object.entries(mockStore).map(([k, v]) => {
        const [kind, id] = k.split(":");
        const cache = Object.entries(mockCache)
          .filter(([ck]) => ck.startsWith(`${k}/`))
          .reduce((n, [, cv]) => n + cv.length, 0);
        return { kind: kind as StorageKind, id, data: Object.values(v).reduce((n, x) => n + x.length, 0), cache };
      });
    }
    return invoke<StorageUsage[]>("app_storage_info");
  },
  /**
   * 1 つのウィジェット・ミニアプリの、データかキャッシュを消す。
   * @param kind 種類
   * @param id フォルダ名
   * @param what `"data"` か `"cache"`
   */
  async appClear(kind: StorageKind, id: string, what: "data" | "cache"): Promise<void> {
    if (!isTauri) {
      const k = `${kind}:${id}`;
      if (what === "data") delete mockStore[k];
      else for (const ck of Object.keys(mockCache)) if (ck.startsWith(`${k}/`)) delete mockCache[ck];
      return;
    }
    return invoke<void>("app_clear", { kind, id, what });
  },
  /**
   * すべてのウィジェット・ミニアプリの、データかキャッシュを消す。
   * @param what `"data"` か `"cache"`
   * @returns 消せた数
   */
  async appClearAll(what: "data" | "cache"): Promise<number> {
    if (!isTauri) {
      if (what === "data") for (const k of Object.keys(mockStore)) delete mockStore[k];
      else for (const k of Object.keys(mockCache)) delete mockCache[k];
      return 1;
    }
    return invoke<number>("app_clear_all", { what });
  },
  /** widgets フォルダ(ウィジェットの置き場所)を、エクスプローラーで開く。 */
  async openWidgetsRoot(): Promise<void> {
    if (!isTauri) return;
    return invoke<void>("open_widgets_root");
  },
  /** miniapps フォルダ(ミニアプリの置き場所)を、エクスプローラーで開く。 */
  async openMiniAppsRoot(): Promise<void> {
    if (!isTauri) return;
    return invoke<void>("open_miniapps_root");
  },
  /**
   * ミニアプリの中の widgets フォルダ(そのミニアプリのウィジェットの置き場所)を開く。
   * @param id ミニアプリのフォルダ名
   */
  async openMiniAppWidgetsDir(id: string): Promise<void> {
    if (!isTauri) return;
    return invoke<void>("open_miniapp_widgets_dir", { id });
  },
  /**
   * ミニアプリ 1 つのフォルダを開く。
   * @param id ミニアプリのフォルダ名
   */
  async openMiniAppDir(id: string): Promise<void> {
    if (!isTauri) return;
    return invoke<void>("open_miniapp_dir", { id });
  },
  /**
   * ホームに、ミニアプリのアイコン(`.alumiapp`)を作る。
   * @param id ミニアプリのフォルダ名
   * @param name 表示名(ブラウザでの確認用にだけ使う)
   * @returns 作ったファイルのパス
   */
  async createMiniAppShortcut(id: string, name: string): Promise<string> {
    if (!isTauri) {
      MOCK_NAMES["mock/launcherFolder"].push(`${name}.alumiapp`);
      mockMiniFiles[`mock/launcherFolder/${name}.alumiapp`] = id;
      return `mock/launcherFolder/${name}.alumiapp`;
    }
    return invoke<string>("create_miniapp_shortcut", { id });
  },
  /**
   * ホームのミニアプリのアイコン(`.alumiapp`)が指す、ミニアプリのフォルダ名を取得する。
   * @param path `.alumiapp` ファイルのパス
   */
  async miniAppOfFile(path: string): Promise<string> {
    if (!isTauri) return mockMiniFiles[path] ?? "memo";
    return invoke<string>("miniapp_of_file", { path });
  },
  /**
   * 追加ウィジェット 1 つのフォルダを開く。
   * @param id ウィジェットのフォルダ名
   */
  async openWidgetDir(id: string): Promise<void> {
    if (!isTauri) return;
    return invoke<void>("open_widget_dir", { id });
  },
  /**
   * スタートメニューのアプリ(通常のアプリ・ストアアプリ)の一覧を取得する。
   * @returns 名前順の一覧
   */
  async listStartApps(): Promise<StartApp[]> {
    if (!isTauri) return MOCK_START_APPS;
    return invoke<StartApp[]>("list_start_apps");
  },
  /**
   * スタートメニューのアプリを、ショートカットとして、ホームに複製して追加する(元のアプリは、そのまま)。
   * @param id `listStartApps` が返した ID
   * @returns 追加先(launcherFolder)のパス
   */
  async addStartApp(id: string): Promise<{ added: number; path: string }> {
    if (!isTauri) return { added: 1, path: "mock/launcherFolder" };
    return invoke<{ added: number; path: string }>("add_start_app", { id });
  },
};
