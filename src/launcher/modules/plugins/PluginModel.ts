import type { ComponentType } from "react";
import type { MiniApp } from "../../shared/api/ApiModel";
import type { MenuAction } from "../../shared/ui/MenuModel";

/**
 * ウィジェットが、アプリの状態を使うための窓口。保存データは、それぞれのフォルダの `data` へ(`AppDataModel.ts`)。
 * `query` / `setQuery` ホームの絞り込み(検索ウィジェット)/ `onSearchEnter` 検索で Enter(最初に見つかったものを開く)/ `flash` 画面に一言出す / `showMenu` 右クリックメニュー / `folderOrder` フォルダの中の並び順 / `homeKeys` ホームにあるもの / `minis` ミニアプリの一覧
 */
export interface WidgetEnv {
  /** ホームの絞り込み(検索ウィジェット) */
  query: string;
  setQuery: (q: string) => void;
  /** 検索で Enter: 最初に見つかったものを開く */
  onSearchEnter: () => void;
  flash: (msg: string) => void;
  /** 右クリックメニューを出す(ウィジェットの中の項目用。出さないときは、ウィジェット全体のメニューになる) */
  showMenu: (x: number, y: number, actions: MenuAction[]) => void;
  /** フォルダの中のアイコンの並び順(ホームのフォルダのアイコンと同じ並びで見せるため)。決まっていなければ `undefined` */
  folderOrder: (folderId: string) => string[] | undefined;
  /** ホームにあるもの(フォルダ `f:<ID>`・アイコン `i:<パス>`)の識別子の一覧。まだ読み込めていないときは `null`(ショートカットウィジェットが、無くなったものを外すのに使う) */
  /** フォルダの一覧の再読み込みの番号(変わると、フォルダの中身を取り直す) */
  folderTick: (path: string) => number;
  homeKeys: ReadonlySet<string> | null;
  /** ミニアプリのフォルダにあるミニアプリの一覧。まだ読み込めていないときは `null` */
  minis: MiniApp[] | null;
}

/** ホームのアイコン・フォルダを、ウィジェットの上へドラッグして落としたときに届く内容(`alumi:drop` イベントの `detail`)。 */
export type DropDetail =
  { kind: "item"; name: string; path: string } | { kind: "folder"; id: string; name: string; path: string };

/**
 * ドロップを知らせるイベントの名前。ドロップを受けたいウィジェットは、要素に `data-drop-target="<名前>"` を付けて、この名前のイベントを聞く。
 * ドラッグ中に指が上に来た要素には、`data-drop-hover="true"` が付く(枠は、ランチャーが描く)。
 */
export const DROP_EVENT = "alumi:drop";

/** 組み込みのウィジェット(ランチャーの画面の中で動く React の部品)。`widget.json` の `builtin` と同じ名前で登録する。 */
export interface WidgetPlugin {
  component: ComponentType<{ env: WidgetEnv }>;
  /** 幅の範囲と標準 `[最小, 最大, 標準]`(マスの数)。`widget.json` の `cells` と同じ値(一覧を読み終えるまでの仮の値に使う) */
  cells?: [number, number, number];
}

/**
 * ミニアプリが `postMessage` で呼べる、ランチャー側の機能(ブリッジ)。`miniapp.json` の `permissions` に `permission` を書いたミニアプリだけが使える。
 * (許可する権限の名前は、`schemas/miniapp.schema.json` が元。)
 */
export interface MiniBridge {
  /** 必要な権限の名前(`miniapp.json` の `permissions`) */
  permission: string;
  /** 受け持つ命令の名前の前半(`player.` なら、`player.state` や `player.cmd`) */
  prefix: string;
  /** 命令を実行する。戻り値が、ミニアプリへ返る。失敗は例外で知らせる */
  handle: (method: string, params: Record<string, unknown>) => unknown;
  /** ミニアプリの画面へ、状態を送り続ける(開いている間だけ)。`post` で送る。画面が読み込まれたときは `push(true)` が呼ばれる */
  connect?: (post: (message: Record<string, unknown>) => void) => { push: (force?: boolean) => void; stop: () => void };
}

/** ランチャーの動きに合わせて呼ばれる関数(省略してよい)。 */
export interface LauncherHooks {
  /** ランチャー全体の音量(0〜1)が決まった・変わったとき */
  onMasterVolume?: (volume: number) => void;
  /** 起動時(以前のデータの移行が終わったあと) */
  onStart?: () => Promise<void> | void;
  /** データを消したあと。`target` を省くと、すべて */
  onDataCleared?: (target?: { kind: "widget" | "miniapp"; id: string }) => void;
}

/**
 * ミニアプリ・ウィジェットが、ランチャーに渡すもの。フォルダの `index.ts(x)` の既定の書き出しにする(ランチャーが自動で見つけて読み込む)。
 */
export interface PluginModule {
  /** 組み込みのウィジェット(`widget.json` の `builtin` の名前 → 部品) */
  widgets?: Record<string, WidgetPlugin>;
  bridges?: MiniBridge[];
  hooks?: LauncherHooks;
}

/**
 * 型の補助(書き間違いを、型で見つけるため)。
 * @param p ランチャーに渡すもの
 * @returns `p` そのもの
 */
export const definePlugin = (p: PluginModule): PluginModule => p;
