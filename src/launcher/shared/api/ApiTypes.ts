/**
 * 画面と Rust 側で共有する型と、設定の初期値・範囲(通信は `ApiModel.ts`、補助は `ApiHelpers.ts`、ブラウザ確認用のダミーは `ApiMock.ts`)。
 */
/** ホームに登録した 1 つのフォルダ。`id` は一意な識別子、`name` は表示名、`path` は実際のフォルダのパス。 */
export interface FolderEntry {
  id: string;
  name: string;
  path: string;
}
/** 背景のテーマ(`gray`=クリア / `dark` / `white` / `accent`=Windows のテーマカラー / `custom`=好きな色 / `image`=背景画像)。 */
export type Theme = "gray" | "dark" | "white" | "accent" | "custom" | "image";
/** UI(時計・ボタン・メニューなど)の色。`"auto"` は背景のテーマと同じ。 */
export type UiTheme = "auto" | "gray" | "dark" | "white" | "accent" | "custom";
/** 利用者が変えられる設定すべて(設定ファイルの `settings`。Rust 側の `Settings` と同じ名前・形)。範囲外の値は、保存のときに Rust 側が安全な値に直す。 */
export interface Settings {
  width: number;
  height: number;
  theme: Theme;
  customColor: string;
  /** UI(時計・ボタン・フォルダ内・メニューなど)の色 */
  uiTheme: UiTheme;
  /** UI の「好きな色」 */
  uiColor: string;
  /** UI(メニュー・設定・ダイアログ・ボタン)の透過度(0-100) */
  uiTransparency: number;
  imageDim: number;
  iconSize: number;
  iconGap: number;
  /** 背景の透過度(0-90、大きいほど透ける) */
  bgTransparency: number;
  /** ホーム(フォルダ一覧)の表示数: auto=画面に合わせる / fixed=個数を指定 */
  homeLayoutMode: "auto" | "fixed";
  homeIconCount: number;
  /** フォルダを開いたモーダルの表示数 */
  modalLayoutMode: "auto" | "fixed";
  modalIconCount: number;
  /** グローバルショートカットで開くか */
  hotkeyEnabled: boolean;
  /** ショートカットの組み合わせ(2〜3キー。先頭は Ctrl / Alt / Shift / Win。例: "Alt+Space+L" "Ctrl+Space") */
  hotkey: string;
  /** 常に最前面に表示するか */
  alwaysOnTop: boolean;
  /** デスクトップモード(デスクトップの代わり): 常に一番後ろ・最大化して固定・閉じる/最小化/最大化をしない */
  desktopMode: boolean;
  /** プリセット(1〜3)を使うか。使わないときは、常にプリセット 1 を表示する */
  presetsEnabled: boolean;
  /** いま選んでいるプリセット。変えるときは api.setPresetMode を使う */
  preset: number;
  /** プリセットの数(1〜9) */
  presetCount: number;
  /** 画像・動画を、アイコンではなくプレビュー(中身の縮小画像)で表示するか */
  previewThumbnails: boolean;
  /** フォルダを開いたモーダルの透過度(0-90) */
  modalTransparency: number;
  /** フォルダを開いたとき背後をぼかす強さ(0-30px) */
  modalBlur: number;
  /** アイコンを長押ししてドラッグできるようになるまでの時間(ms) */
  dragDelayMs: number;
  /** 別のアイコンに重ねて止めてから、フォルダを作れる/フォルダへ入れられる状態になるまでの時間(ms) */
  mergeDelayMs: number;
  /** 時刻と日付を表示するか */
  showClock: boolean;
  /** ヘッダー(上のウィジェット欄)を使うか */
  headerEnabled: boolean;
  /** フッター(下のウィジェット欄)を使うか */
  footerEnabled: boolean;
  /** ヘッダー/フッターに並べるウィジェットの ID("clock" / "memo" / "mod:<フォルダ名>") */
  headerWidgets: string[];
  footerWidgets: string[];
  /** ウィジェットごとの大きさ(倍率。1 が標準) */
  widgetScales: Record<string, number>;
  /** ウィジェットの置き場所。キーは "header:<ID>" / "footer:<ID>"、値は [開始のマス(1〜7), 幅(マスの数)]。ヘッダー・フッターは横 7 マス */
  widgetCells: Record<string, [number, number]>;
  /** ヘッダーの高さ(縦のマスの数。1 = 小・2 = 標準・3 = 大)。ヘッダーを右クリックして決める。ヘッダーのウィジェットは、すべて、この高さになる */
  headerRows: number;
  /** フッターの高さ(縦のマスの数)。ヘッダーと同じ */
  footerRows: number;
  /** 外部のサーバーと通信してよいと同意した、ウィジェット・ミニアプリ("widget:<名前>" / "miniapp:<名前>" / "widget:<ミニアプリ>/<名前>") */
  networkAllowed: string[];
  /** (以前の保存場所。いまは使わない。ウィジェット・ミニアプリのデータは、それぞれのフォルダの data に保存する) */
  widgetData: Record<string, string>;
  /** ランチャーが出す音全体の音量(0-100。100 は、PC の音量設定のまま) */
  masterVolume: number;
  /** ボタンなどにカーソルを合わせたときの説明(ツールチップ)を出すか */
  showTooltips: boolean;
}

/** 音楽プレーヤーに登録した音声ファイル。`url` は再生に使うアドレス(`miniapp` プロトコル)。 */
export interface MusicTrack {
  name: string;
  path: string;
  url: string;
}

/** スタートメニューのアプリ 1 つ(`id` は、追加するときに渡す)。 */
export interface StartApp {
  name: string;
  id: string;
}

/** 追加ウィジェット(widgets フォルダ、またはミニアプリの中の widgets フォルダ)。`widget.json` の内容を検査したもの。組み込みのウィジェットの定義も、同じ形で入っている(`builtin` が空でない)。 */
export interface ModWidget {
  /** フォルダ名 */
  id: string;
  name: string;
  description: string;
  entry: string;
  /** アイコン画像(フォルダ内のパス。無ければ空) */
  icon: string;
  width: number;
  height: number;
  /** 組み込みのウィジェットの種類("clock" など)。追加ウィジェットでは空 */
  builtin: string;
  /** データを共有するミニアプリのフォルダ名(無ければ空) */
  dataApp: string;
  /** 外部のサーバーと通信すると宣言しているか(初めて使うとき、利用者の同意が要る) */
  network: boolean;
  nameEn: string;
  descriptionEn: string;
  /** 幅の範囲と標準([最小, 最大, 標準]。マスの数)。決まっていなければ [0, 0, 0] */
  cells: [number, number, number];
  /** "mod"(widgets フォルダ)か "mini"(ミニアプリの中) */
  kind: "mod" | "mini";
  /** kind が "mini" のとき、持ち主のミニアプリのフォルダ名と名前(日本語・英語表示のときの名前) */
  app: string;
  appName: string;
  appNameEn: string;
}

/** ミニアプリ(miniapps フォルダ)。`miniapp.json` の内容を検査したもの。 */
export interface MiniApp {
  id: string;
  name: string;
  description: string;
  /** 英語表示のときの名前・説明(無ければ空) */
  nameEn: string;
  descriptionEn: string;
  entry: string;
  icon: string;
  /** 使える機能: "saveText"(ホームにテキストを保存)/ "storage"(アプリ専用の保存領域) */
  permissions: string[];
  /** Web サイトを開くミニアプリのとき、その URL(https)。普通のミニアプリでは空 */
  url: string;
  /** 外部のサーバーと通信するか(Web サイトを開くものは、常に true)。初めて使うとき、利用者の同意が要る */
  network: boolean;
}

/** ドロップで取り込んだウィジェット・ミニアプリ。 */
export interface Installed {
  kind: "widget" | "miniapp";
  id: string;
  name: string;
}

/** データ・キャッシュの置き場所の種類(`widgets` フォルダ / `miniapps` フォルダ)。 */
export type StorageKind = "widget" | "miniapp";
/** ウィジェット・ミニアプリ 1 つの、データ・キャッシュの大きさ(バイト)。 */
export interface StorageUsage {
  kind: StorageKind;
  id: string;
  data: number;
  cache: number;
}

/** 画像ビューアに登録した画像。`url` は表示用、`thumb` は小さな見本のアドレス。 */
export interface ImageEntry {
  name: string;
  path: string;
  url: string;
  thumb: string;
}

/** 設定の初期値(Rust 側の `Settings::default` と同じにしておくこと)。「デフォルト値にする」と、設定ファイルが無いときに使う。 */
export const DEFAULT_SETTINGS: Settings = {
  width: 520,
  height: 720,
  theme: "gray",
  customColor: "#3b82f6",
  uiTheme: "auto",
  uiColor: "#3b82f6",
  uiTransparency: 0,
  imageDim: 40,
  iconSize: 90,
  iconGap: 18,
  bgTransparency: 22,
  homeLayoutMode: "auto",
  homeIconCount: 9,
  modalLayoutMode: "auto",
  modalIconCount: 9,
  hotkeyEnabled: true,
  hotkey: "Ctrl+Alt+L",
  alwaysOnTop: false,
  desktopMode: false,
  presetsEnabled: true,
  preset: 1,
  presetCount: 3,
  previewThumbnails: true,
  modalTransparency: 12,
  modalBlur: 10,
  dragDelayMs: 500,
  mergeDelayMs: 500,
  showClock: true,
  headerEnabled: true,
  footerEnabled: false,
  headerWidgets: ["clock"],
  footerWidgets: [],
  widgetScales: {},
  widgetCells: {},
  headerRows: 2,
  footerRows: 2,
  widgetData: {},
  masterVolume: 100,
  showTooltips: false,
  networkAllowed: [],
};
/** 設定の各項目の、許される範囲(画面のスライダーの範囲。Rust 側の検査と同じにしておくこと)。 */
export const MODAL_BLUR_RANGE = { min: 0, max: 30 };
export const DRAG_DELAY_RANGE = { min: 200, max: 2000 };
export const MERGE_DELAY_RANGE = { min: 500, max: 5000 };
export const ICON_COUNT_RANGE = { min: 1, max: 64 };
export const ICON_SIZE_RANGE = { min: 48, max: 128 };
export const ICON_GAP_RANGE = { min: 0, max: 60 };
export const TRANSPARENCY_RANGE = { min: 0, max: 100 };
export const DIM_RANGE = { min: 0, max: 80 };
export const PRESET_COUNT_RANGE = { min: 1, max: 9 };
export const MIN_SIZE = { width: 240, height: 60 };

/** 設定ファイルのうち、画面が受け取る部分。`orders` は、フォルダ ID(ホームは `__home__`)→ アイテムのパスの並び順。 */
export interface Config {
  folders: FolderEntry[];
  /** フォルダID → アイテムパスの並び順 */
  orders?: Record<string, string[]>;
  settings?: Settings;
}

/** エクスプローラーからのドラッグ&ドロップのイベント(`over` 上に来た / `leave` 出ていった / `drop` 落とされた)。 */
export type DropEvent = { type: "over" } | { type: "leave" } | { type: "drop"; paths: string[] };
/** フォルダの中の 1 つのアイコン(ファイル)。`name` は拡張子を含むファイル名。 */
export interface Item {
  name: string;
  path: string;
}
