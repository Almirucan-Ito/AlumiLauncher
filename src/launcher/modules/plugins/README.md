# modules/plugins(ミニアプリ・ウィジェットとのつなぎ口)

ミニアプリ・ウィジェットのフォルダにある `index.ts(x)` を、自動で集め、ランチャーが使える形にします。

## 担当すること

- `PluginRegistry.ts`: `src/miniapps/*/index.{ts,tsx}` と `src/widgets/*/index.{ts,tsx}` を、`import.meta.glob` で集める(フォルダを足すだけで載る)。
  集めたものを、3 つに分けて出す: `widgetPlugins`(組み込みウィジェットの部品)・`miniBridges`(ミニアプリが呼べる機能)・`launcherHooks`(ランチャーの動きに合わせて呼ぶ関数)。
- `PluginModel.ts`: それらの型(`WidgetEnv`・`WidgetPlugin`・`MiniBridge`・`LauncherHooks`・`PluginModule`)と、型の補助 `definePlugin`、ドロップのイベント名 `DROP_EVENT`。

## 担当しないこと

- ウィジェットを欄に並べること(`modules/widgets`)、ミニアプリを開くこと(`modules/miniapps`)。ここは、集めて、型を決めるだけ。
- 個々のミニアプリ・ウィジェットの中身。

## 設計の理由

- **ランチャーは、個々のミニアプリ・ウィジェットを、名前で読み込まない**(ESLint が検査している)。必ず、ここで集めたものを通す。
  → ミニアプリ・ウィジェットを足したり消したりしても、ランチャーの側は、書き換えない。依存は、ミニアプリ・ウィジェット → ランチャーの、一方向だけ。
- **ミニアプリが呼べる機能(`MiniBridge`)は、権限で守る**: `miniapp.json` の `permissions` に `permission` を書いたミニアプリだけが使える
  (許可する権限の名前は、`schemas/miniapp.schema.json` が元)。
- **ウィジェットには、ランチャーの内部を、そのまま渡さない**: 使ってよい窓口だけを `WidgetEnv` にまとめて渡す(検索の入力・通知・メニュー・並び順など)。
- **ドロップの受け方は、DOM のイベントで決める**: ドロップを受けたいウィジェットは、要素に `data-drop-target` を付けて、`alumi:drop` を聞く。
  ランチャーが、ドラッグ中の枠(`data-drop-hover`)を描くので、ウィジェットは、枠を描かなくてよい。

## 新しいプラグインを足すとき

1. `src/miniapps/<id>/index.tsx`(または `src/widgets/<id>/index.tsx`)を作り、`export default definePlugin({ … })` を書く。
2. `widgets` / `bridges` / `hooks` の、必要なものだけを渡す(どれも省略してよい)。
3. 組み込みウィジェットは、`widget.json` の `builtin` と同じ名前で、`widgets` に登録する。
4. 新しい権限を足すなら、`schemas/miniapp.schema.json` にも足す(足し忘れは、テストが知らせる)。

詳しい使い方は `docs/extending.md`、全体の図は `docs/architecture.md`。
