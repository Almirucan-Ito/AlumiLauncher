# 構造の説明

> English: [architecture_EN.md](architecture_EN.md)(この文書の英語の概要)

## 全体像

```
┌──────────────── WebView2(画面) ────────────────┐        ┌──── Rust(src-tauri) ────┐
│ modules/*  ──→  shared/api(ApiModel.ts…) ─invoke──→ │ commands(config/files/…)  │
│  React の画面・フック      型・保存・通信            │ extensions/widgets/ …      │
│  └ <iframe sandbox>  ミニアプリ / ウィジェット(HTML) │ widget:// miniapp:// 配信   │
└──────────────────────────────────────────────────┘        └───────────────────────────┘
```

- **画面**は React / TypeScript。ブラウザだけ(`npm run dev`)でも動くように、`ApiModel.ts` は Tauri が無いとき疑似動作に切り替わります(ミニアプリ・ウィジェットの一覧は、フォルダの JSON をそのまま読みます)。
- **本体**は Rust(`src-tauri/src`)。Win32 の機能(アイコン取得、ドラッグアウト、サムネイル、ショートカット)と、ファイルの保存を担当します。

## 3 つの領域

| 領域         | 場所            | 中身                                                                  |
| ------------ | --------------- | --------------------------------------------------------------------- |
| ランチャー   | `src/launcher/` | 本体。機能ごとのフォルダ(`modules/`)+ 共通の部品(`shared/`)           |
| ミニアプリ   | `src/miniapps/` | 1 フォルダ = 1 アプリ。`view/`(HTML・CSS)と `controller/`(JavaScript) |
| ウィジェット | `src/widgets/`  | 1 フォルダ = 1 つ。React の部品は `view/`・`model/`・`i18n.ts` を持つ |

依存は **一方向** です: ミニアプリ・ウィジェット → `src/launcher` の部品(`shared/` の `ApiModel`・`AppDataModel`・`lib/` など)。`src/launcher` からミニアプリ・ウィジェットを名前で読み込むことはしません(ESLint で検査)。

### つなぎ方(プラグイン)

ミニアプリ・ウィジェットのフォルダに `index.tsx` があると、`src/launcher/modules/plugins/PluginRegistry.ts` が `import.meta.glob` で自動で集めます(ランチャー側は、書き換えません)。`index.tsx` の既定の書き出しは `definePlugin({ ... })` で、次の 3 つを渡せます(型は `PluginModel.ts`)。

| 項目      | 内容                                                                                       | ランチャー側の使い方                                                            |
| --------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `widgets` | 組み込みウィジェットの部品(`widget.json` の `builtin` と同じ名前 → `{ component, cells }`) | `WidgetBar` が、ID から部品を取り出して表示する                                 |
| `bridges` | ミニアプリが `postMessage` で呼べる機能(`permission`・`prefix`・`handle`・`connect`)       | `miniapp.tsx` が、`prefix` に合う命令を渡す(権限のないミニアプリには、渡さない) |
| `hooks`   | `onMasterVolume`(音量)・`onStart`(起動時)・`onDataCleared`(データを消したあと)             | `App.tsx`(と `useStartupRestore`)が、その時に呼ぶ                               |

例: `miniapps/music/index.tsx` は、音楽プレーヤーの本体(ミニアプリを閉じても曲が鳴り続けるよう、ランチャーの画面側に 1 つだけ持つ)を、ウィジェット・`player.*` の窓口・起動時の復元として、ランチャーにつないでいます。

## ランチャー本体の構成(`src/launcher`)

機能ごとにフォルダを分けています(1 つの機能に関わる画面・状態・処理・型が、同じフォルダに集まります)。

| 場所                   | 中身                                                                                                                                                                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `App.tsx` / `main.tsx` | 入口と、全体の組み立て(何を開いているかの状態を持ち、下の各機能のフックと部品をつなぐ。約 400 行)                                                                                                                                                                                                                        |
| `modules/shell/`       | アプリの外枠。部品(`TitleBar`・`PresetSwitcher`・`CornerButtons`・`ConsentDialog`・`DeleteDialog`・`ContextMenu`)と、フック(設定の保存 `useConfigStore`・ウィンドウの状態 `useWindowMode`・通知 `useToast`・キー操作 `useGlobalKeys`・起動時の復元 `useStartupRestore`・Rust 側からの通知 `useBackendEvents`)            |
| `modules/home/`        | ホーム画面(`HomeScreen`・右クリックメニュー `useHomeMenus`)・ホームの並び(`HomeModel`・`useHomeEntries`)・検索(`useHomeSearch`)・ホームとフォルダ内のドラッグの受け渡し(`useDragHandover`)・エクスプローラーからのドロップ(`useExplorerDrop`)                                                                            |
| `modules/folders/`     | フォルダ(ホームのタイル `FolderTile`、開いた画面 `FolderView`、名前の変更 `RenameDialog`、一覧の取得 `useFolderItems`、並び順 `FolderModel`)と、フォルダ・アイコンの操作(`useFolderActions`)                                                                                                                             |
| `modules/history/`     | 元に戻す(Ctrl+Z)/ やり直し(Ctrl+Y)(`useUndoHistory`)                                                                                                                                                                                                                                                                     |
| `modules/settings/`    | 設定の画面(`SettingsPanel`、グループごとの `SizeGroup`・`AppearanceGroups`・`LayoutGroup`、`SliderRow`・`HotkeyRow`・`QuitButton`、選択肢 `SettingsModel`)・設定の変更(`useSettingsActions`)・足りない項目の補い(`normalizeSettings`)・テーマの CSS 変数(`ThemeModel`)・説明(ツールチップ)の切り替え(`useTooltipToggle`) |
| `modules/widgets/`     | ウィジェットの欄(`AppWidgetBar`・`WidgetBar`)・一覧(`useWidgetList`)・追加画面(`WidgetPicker`)・置き場所の計算(`LayoutModel`)・追加/移動/大きさ/メニュー(`useWidgetBars`)                                                                                                                                                |
| `modules/miniapps/`    | ミニアプリの窓口(`miniapp.tsx`)・一覧の画面(`MiniAppPicker`)・開く、同意、ランチャーの機能を貸す(`useMiniApps`)・アラーム(`AlarmController`)・旧データの移行(`MigrationController`)・データ/キャッシュの大きさと消去(`useStorageManagement`)                                                                             |
| `modules/start-apps/`  | 「スタートメニューから追加」の画面                                                                                                                                                                                                                                                                                       |
| `modules/icons/`       | アイコンの取得とキャッシュ(`IconController`)                                                                                                                                                                                                                                                                             |
| `modules/plugins/`     | ミニアプリ・ウィジェットを自動で集める仕組み(`PluginModel`・`PluginRegistry`)                                                                                                                                                                                                                                            |
| `shared/api/`          | Rust との通信。窓口 `api`(`ApiModel.ts`)は、領域ごとのファイル(`ApiApp`・`ApiWindow`・`ApiFiles`・`ApiExtensions`・`ApiMedia`)を 1 つにまとめたもの。ほかに、型と設定の初期値(`ApiTypes.ts`)・補助(`ApiHelpers.ts`)・ブラウザ確認用のダミー(`ApiMock.ts`)・保存データ(`AppDataModel.ts`)・動きの数値(`TuningModel.ts`)   |
| `shared/ui/`           | 機能をまたぐ画面の部品(`Pager`(ページ送りの一覧。ドラッグ操作は `usePagerDrag`、引数の型は `PagerProps`)・`AppTile`・`IconImg`・`flat`・`storageui`)                                                                                                                                                                     |
| `shared/drag/`         | ドラッグの道具(`PickDragController`・`ShiftKeyController`)                                                                                                                                                                                                                                                               |
| `shared/audio/`        | 合図の音(`BeepController`)                                                                                                                                                                                                                                                                                               |
| `shared/i18n/`         | 文言(取り出す `i18n.ts`・日本語の辞書 `messages.ja.ts`・英語の辞書 `messages.en.ts`)                                                                                                                                                                                                                                     |
| `shared/styles/`       | スタイル(入口 `styles.css` が、機能ごとのファイルを順に読み込む。順番が優先の順番)                                                                                                                                                                                                                                       |
| `shared/lib/`          | 小さな道具(`MathUtil`・`LangUtil`・`FormatUtil`・`MessageUtil`・`IdUtil`・`ColorUtil`・`PathUtil`)                                                                                                                                                                                                                       |

決まり: 機能(`modules/*`)は、`shared/` を使ってよく、機能どうしの依存は最小にします。`shared/` は、機能を使いません。

`App.tsx`(約 750 行)は、「何を開いているか」の状態(開いているフォルダ・メニュー・設定・各ダイアログなど)を持ち、機能ごとのフック(`use〜`)と部品をつなぐだけにしています。処理は、フックに取り出してあります(元に戻す `useUndoHistory`・フォルダの操作 `useFolderActions`・ミニアプリ `useMiniApps`・設定の変更 `useSettingsActions`・ウィジェットの欄 `useWidgetBars`・データの消去 `useStorageManagement`・ドラッグ `useDragHandover` / `useExplorerDrop`・キー操作 `useGlobalKeys` など)。フックどうしは、`configRef`(常に最新の設定)・`mutate`(設定の変更と保存)・`flash`(通知)・`launcherRef`・`entriesRef` などを、引数で受け渡します。新しい機能を足すときは、`App.tsx` に処理を書かず、`modules/` に、フックとして足してください。ウィジェット固有の見た目(CSS)は、そのウィジェットのフォルダにあります(`widgets/<名前>/view/style.css`、ミュージックは `miniapps/music/view/widget.css`)。ウィジェットの `.tsx` が `import "./style.css"` で読み込みます。本体の `styles.css`(`main.tsx` が先に読む)の後に読み込まれるので、同じ強さの規則では、ウィジェット側が勝ちます。全ウィジェットで共通のもの(`.wcard`・`.wdim`・`.wx` やヘッダー・フッターの配置)は、本体の `shared/styles/` に残しています。

## ミニアプリとウィジェット

- 1 フォルダ = 1 つ。`miniapp.json`(または `widget.json`)と、`view/`・`controller/` などで完結します。
- 実行時の置き場所は、`%AppData%\AlumiLauncher\miniapps\<id>\` と `widgets\<id>\`(ポータブル版は `<exe>\data` の中)。
- 同梱のものは、`src-tauri/build.rs` が、`src/miniapps/*`・`src/widgets/*` のフォルダごと実行ファイルに埋め込みます(`_` で始まるフォルダ(見本)と `common`、`.ts` / `.tsx` は除く)。起動時に、上の場所へ書き出されます。**版は、埋め込む内容のハッシュ**なので、内容を変えれば、次の起動で自動で書き換わります。利用者が削除したものは、`.alumi-seeded` の記録により作り直されません。
- ウィジェット一覧の検査に使う `builtin` の種類(許可リスト)も、`build.rs` が `widget.json` から作ります(Rust を書き換える必要はありません)。
- 画面には `miniapp://` / `widget://` のプロトコルで配信され、`<iframe sandbox>` の中で動きます。本体には直接触れず、`postMessage` で依頼します。

### postMessage の窓口

ミニアプリ → ランチャー:`{ alumi: 1, id, method, params }`。返事は `{ alumi: 1, id, ok, result | error }` です。

| method                                                        | 必要な権限 | 実装                                                   |
| ------------------------------------------------------------- | ---------- | ------------------------------------------------------ |
| `close`、`toast`                                              | (なし)     | `miniapp.tsx`                                          |
| `saveText`                                                    | `saveText` | `miniapp.tsx`                                          |
| `storage.get` / `storage.set`、`cache.get` / `cache.set`      | `storage`  | `miniapp.tsx`                                          |
| `home.texts` / `home.read` / `home.write`                     | `files`    | `miniapp.tsx`                                          |
| `launcher.search` / `launcher.launch`                         | `launcher` | `miniapp.tsx`                                          |
| `images.pick`                                                 | `images`   | `miniapp.tsx`                                          |
| `alarm.set` / `alarm.cancel` / `alarm.list` / `alarm.collect` | `alarm`    | `miniapp.tsx`                                          |
| `player.state` / `player.cmd`                                 | `player`   | `miniapps/music/controller/PlayerBridge.ts`(`bridges`) |

共通の機能は `src/launcher/modules/miniapps/miniapp.tsx` の `switch (method)` が正で、ミニアプリが持ち込む機能は `bridges`(上記)です。許可する権限の名前は、`schemas/miniapp.schema.json` が元です(Rust は、ビルドのときに、これを読みます)。新しい権限を足すときは、スキーマに足して、窓口を実装します(足し忘れは、テストが知らせます)。

### 外部通信

`miniapp.json` に `"network": true` を書いたものだけが対象です。利用者が初めて使うときに同意し、同意した後だけ、CSP の `connect-src` が開きます。

## データの置き場所

| 内容                              | 場所                                                     |
| --------------------------------- | -------------------------------------------------------- |
| 設定・ホームの並び                | `%AppData%\AlumiLauncher\`(ポータブル版は `<exe>\data\`) |
| ミニアプリ / ウィジェットのデータ | それぞれのフォルダの `data\`(消えてよいものは `cache\`)  |

## 起動の流れ

Rust が起動 → 同梱のミニアプリ・ウィジェットを書き出す(版のハッシュが違うときだけ)→ 画面が設定とアイコンを読み込む(`whenIconsSettled` で揃うまで待つ)→ 各プラグインの `onStart`(音楽プレーヤーの復元など)→ `app_ready` で画面を表示。

## テストと検査

- Rust: `cargo test`(マニフェストの検査、パスの安全性、保存、同梱の定義の検査など)
- 画面: Vitest(`npm test`。配置の計算・並び順・元に戻す履歴・ショートカットの検査・保存データの読み込みなど。TypeScript と Rust で同じにしておく値のずれも確認)。ドラッグ操作など、画面の動きは、型(`tsc`)・ESLint・`npm run dev` での目視で確認します。
- ミニアプリ・ウィジェット: `npm run check:miniapps`(JSON、`entry`・`icon`・読み込むファイルの有無、`<script>` の文法、組み込みウィジェットの登録)、`npm run check:js`(`controller/*.js` を、**ミニアプリ・ウィジェットごとの組で、別々に**型検査して、存在しない名前・呼び出しの引数の数の違い・呼べないものの呼び出し・数でない値の計算などを見つける。ファイルは普通の `<script>` なので、同じミニアプリのファイル(同じページで続けて読み込む = トップレベルの名前を共有する)は、まとめて 1 組にして検査し、別のミニアプリのファイルとは、トップレベルの名前が別物。DOM の型の細かい指摘は無視する。ブラウザが持つ名前(`status` など)と同じ名前の関数を、トップレベルに置かないこと)
