// ファイル・フォルダ: 一覧とアイコン・追加と移動・作成・読み書き・起動・削除・エクスプローラー・背景画像・ダイアログ
// `api`(ApiModel.ts)に、他の領域といっしょに、まとめて渡される。

import { fallbackIcon, invoke, isTauri } from "./ApiHelpers";
import { MOCK_NAMES, blobUrl, mockCounts, mockState, mockTexts } from "./ApiMock";
import { type Item } from "./ApiTypes";

/** ファイル・フォルダ: 一覧とアイコン・追加と移動・作成・読み書き・起動・削除・エクスプローラー・背景画像・ダイアログ */
export const filesApi = {
  /**
   * フォルダの中のアイコンの一覧を取得する。
   * @param path 登録済みフォルダ(またはホームの保存先)のパス
   */
  async listItems(path: string): Promise<Item[]> {
    if (!isTauri) {
      await new Promise((r) => setTimeout(r, 60));
      return (MOCK_NAMES[path] ?? []).map((name) => ({ name, path: `${path}/${name}` }));
    }
    return invoke<Item[]>("list_items", { path });
  },
  /**
   * ファイルのアイコンを、画像(data URI)で取得する。
   * @param item 対象のファイル
   */
  async getIcon(item: Item): Promise<string> {
    if (!isTauri) return fallbackIcon(item.name);
    return invoke<string>("get_icon", { path: item.path });
  },
  /**
   * フォルダを一覧に登録してよいか(ドライブ直下や Windows フォルダは不可)。
   * @param path フォルダのパス
   */
  async validateFolder(path: string): Promise<boolean> {
    if (!isTauri) return true;
    return invoke<boolean>("validate_folder", { path });
  },
  /**
   * ドロップされたファイルを、開いているフォルダに追加する(移動)。
   * @param dir 追加先のフォルダ
   * @param paths ファイルのパス
   * @returns 追加できた数
   */
  async addToFolder(dir: string, paths: string[]): Promise<number> {
    if (!isTauri) return paths.length;
    return invoke<number>("add_to_folder", { dir, paths });
  },
  /** ホームに直接並べるショートカットの保存先(データ保持用フォルダ内の launcherFolder)のパス */
  async getLauncherFolder(): Promise<string> {
    if (!isTauri) return "mock/launcherFolder";
    return invoke<string>("get_launcher_folder");
  },
  /** ホームにドロップされたショートカット・ファイルを、データ保持用の launcherFolder に保存する */
  async addToLauncherFolder(paths: string[]): Promise<{ added: number; path: string }> {
    if (!isTauri) return { added: paths.length, path: "mock/launcherFolder" };
    return invoke<{ added: number; path: string }>("add_to_launcher_folder", { paths });
  },
  /** 登録済みフォルダ内のファイルを、別のフォルダ(またはホームの launcherFolder)へ移動する。戻り値は移動後のパス */
  async moveItem(path: string, targetDir: string): Promise<string> {
    if (!isTauri) return `${targetDir}/${path.split("/").pop()}`;
    return invoke<string>("move_item", { path, targetDir });
  },
  /**
   * フォルダ直下のファイルを、すべて別のフォルダへ移動する。
   * @param srcDir 元のフォルダ
   * @param dstDir 移動先のフォルダ
   * @returns 移動後のパス(元に戻す/やり直し用)
   */
  async moveAll(srcDir: string, dstDir: string): Promise<string[]> {
    if (!isTauri) return [];
    return invoke<string[]>("move_all", { srcDir, dstDir });
  },
  /** ホームのアイコンから新しいフォルダを作って中に入れる。戻り値は作ったフォルダのパス */
  async createFolder(id: string, paths: string[]): Promise<string> {
    if (!isTauri) return `mock/${id}`;
    return invoke<string>("create_folder", { id, paths });
  },
  /** ホーム(launcherFolder)にテキストファイルを作る。戻り値は作ったファイルのパス */
  async createTextFile(name: string, content: string, fallback: string): Promise<string> {
    if (!isTauri) {
      const n = (name.trim() || fallback).replace(/\.txt$/i, "");
      MOCK_NAMES["mock/launcherFolder"].push(`${n}.txt`);
      return `mock/launcherFolder/${n}.txt`;
    }
    return invoke<string>("create_text_file", { name, content, fallback });
  },
  /**
   * 「よく使うもの」/「最近開いた」の上位 5 件を取得する。
   * @param kind `"frequent"`(起動回数の順)か `"recent"`(新しい順)
   */
  async listUsage(kind: "frequent" | "recent"): Promise<Item[]> {
    if (!isTauri) {
      const paths =
        kind === "recent"
          ? mockState.usage
          : [...mockState.usage].sort((a, b) => (mockCounts[b] ?? 0) - (mockCounts[a] ?? 0));
      return paths.slice(0, 5).map((path) => ({ name: path.split("/").pop() ?? path, path }));
    }
    return invoke<Item[]>("list_usage", { kind });
  },
  /** ホーム(launcherFolder)にあるテキストファイル(.txt / .md)の一覧を返す。 */
  async listHomeTexts(): Promise<Item[]> {
    const home = await this.getLauncherFolder();
    const items = await this.listItems(home);
    return items.filter((i) => /\.(txt|md)$/i.test(i.path));
  },
  /**
   * ホームのテキストファイルを読む(登録済みフォルダの中だけ)。
   * @param path ファイルのパス
   */
  async readTextFile(path: string): Promise<string> {
    if (!isTauri) return mockTexts[path] ?? "";
    return invoke<string>("read_text_file", { path });
  },
  /**
   * ホームのテキストファイルを上書きする(すでにあるものだけ)。
   * @param path ファイルのパス
   * @param content 新しい中身
   */
  async writeTextFile(path: string, content: string): Promise<void> {
    if (!isTauri) {
      mockTexts[path] = content;
      return;
    }
    return invoke<void>("write_text_file", { path, content });
  },
  /**
   * パスの一覧から、フォルダだけを残す。
   * @param paths パスの一覧
   */
  async filterDirs(paths: string[]): Promise<string[]> {
    if (!isTauri) return paths;
    return invoke<string[]>("filter_dirs", { paths });
  },
  /**
   * ファイルを選ぶダイアログ(複数選べる)。
   * @returns 選んだパス
   */
  async pickFiles(): Promise<string[]> {
    if (!isTauri) return [];
    const { open } = await import("@tauri-apps/plugin-dialog");
    const r = await open({ directory: false, multiple: true });
    return Array.isArray(r) ? r : typeof r === "string" ? [r] : [];
  },
  /**
   * 画像ファイルを 1 つ選ぶダイアログ。
   * @param filterName フィルターの表示名
   * @returns 選んだパス。キャンセルなら `null`
   */
  async pickImage(filterName: string): Promise<string | null> {
    if (!isTauri) return null;
    const { open } = await import("@tauri-apps/plugin-dialog");
    const r = await open({
      directory: false,
      multiple: false,
      filters: [{ name: filterName, extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"] }],
    });
    return typeof r === "string" ? r : null;
  },
  /**
   * 選んだ画像を背景として取り込み、表示用の URL を返す(画像のバイト列をそのまま Blob にする。Base64 の文字列にしないので、メモリが小さい)。
   * @param src 選んだ画像のパス
   */
  async importBackground(src: string): Promise<string> {
    return blobUrl(await invoke<ArrayBuffer>("import_background", { src }));
  },
  /**
   * 保存してある背景画像を読み込み、表示用の URL を返す。起動直後は、読み込みが一時的に失敗することがあるので、「画像が無い」以外の失敗は、待ってやり直す(最大 4 回)。
   * @returns URL。画像が無いとき・失敗が続いたときは `null`
   */
  async loadBackground(): Promise<string | null> {
    if (!isTauri) return null;
    // 起動直後(インストール直後など)は、読み込みが一時的に失敗することがある。「画像が無い」以外は、少し待ってやり直す
    for (let i = 0; i < 4; i++) {
      try {
        return blobUrl(await invoke<ArrayBuffer>("load_background"));
      } catch (e) {
        if (String(e).includes("none")) return null; // 背景画像がまだ無い
        await new Promise((r) => setTimeout(r, 400 * (i + 1)));
      }
    }
    return null;
  },
  /**
   * 登録したフォルダやホームの中身が、外(エクスプローラーなど)で変わったときに呼ばれる関数を登録する。
   * @param cb 変わったフォルダのパスを受け取る関数
   * @returns 登録を解除する関数
   */
  async onFolderChanged(cb: (path: string) => void): Promise<() => void> {
    if (!isTauri) return () => {};
    const { listen } = await import("@tauri-apps/api/event");
    return listen<string>("folder-changed", (e) => cb(e.payload));
  },
  /**
   * ミニアプリのフォルダが、外(エクスプローラーなど)で増えた・減ったときに呼ばれる関数を登録する(ミニアプリ 1 つ分のフォルダの増減だけ。中のデータの書き込みでは呼ばれない)。
   * @param cb 呼ばれる関数
   * @returns 登録を解除する関数
   */
  async onMiniappsChanged(cb: () => void): Promise<() => void> {
    if (!isTauri) return () => {};
    const { listen } = await import("@tauri-apps/api/event");
    return listen("miniapps-changed", () => cb());
  },
  /**
   * エクスプローラーで開く。
   * @param path 対象のパス
   * @param select `true` なら、そのファイルを選択した状態で、フォルダを開く
   */
  async reveal(path: string, select: boolean): Promise<void> {
    if (!isTauri) return console.log("reveal", path, select);
    await invoke("reveal", { path, select });
  },
  /**
   * ファイルを起動する。起動したら、「よく使うもの」「最近開いた」を更新させる。
   * @param path 起動するファイルのパス
   */
  async launch(path: string): Promise<void> {
    if (!isTauri) {
      console.log("launch", path);
      mockState.usage = [path, ...mockState.usage.filter((p) => p !== path)];
      mockCounts[path] = (mockCounts[path] ?? 0) + 1;
      window.dispatchEvent(new Event("alumi:launched"));
      return;
    }
    await invoke("launch", { path });
    window.dispatchEvent(new Event("alumi:launched")); // 「よく使うもの」「最近開いた」を更新する
  },
  /**
   * フォルダを選ぶダイアログ(ブラウザでの確認用は、パスを入力する欄)。
   * @returns 選んだフォルダ。キャンセルなら `null`
   */
  async pickFolder(): Promise<string | null> {
    if (!isTauri) return window.prompt("フォルダのパス", "C:\\Users\\me\\Shortcuts");
    const { open } = await import("@tauri-apps/plugin-dialog");
    const r = await open({ directory: true, multiple: false });
    return typeof r === "string" ? r : null;
  },
  /**
   * アイコン(ファイル)を OS 標準のドラッグで運び、デスクトップやエクスプローラーのフォルダへ移動する。
   * @param path ドラッグするファイルのパス
   * @returns 移動されたか
   */
  async startFileDrag(path: string): Promise<boolean> {
    if (!isTauri) return (console.log("drag out", path), false);
    return invoke<boolean>("start_file_drag", { path });
  },
  /**
   * 登録済みフォルダ内のファイルを、ごみ箱へ移動する。
   * @param path ファイルのパス
   */
  async deleteItem(path: string): Promise<void> {
    if (!isTauri) return console.log("delete", path);
    await invoke("delete_item", { path });
  },
  /**
   * 「プログラムから開く」(アプリを選ぶ画面)を出す。
   * @param path 開くファイルのパス
   */
  async openWith(path: string): Promise<void> {
    if (!isTauri) return console.log("openWith", path);
    await invoke("open_with", { path });
  },
  /**
   * プロパティの画面を出す。
   * @param path ファイル・フォルダのパス
   */
  async showProperties(path: string): Promise<void> {
    if (!isTauri) return console.log("properties", path);
    await invoke("show_properties", { path });
  },
};
