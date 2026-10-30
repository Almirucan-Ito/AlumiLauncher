# 開発に参加するには

> **言語について**: Issue・Pull Requestのコメントは、**日本語**で書いてください。
> 作者は英語を読めないため英語のものには、返事ができないことがあります。
> 短く、はっきり(題名・何を変えたか・なぜか)書いてもらえると、助かります。

AlumiLauncher は、Windows 用の「スマートフォンのホーム画面風」ランチャーです(Tauri 2 + React / TypeScript + Rust)。
この文書は、はじめてソースを触る人向けの手引きです。
環境のつくり方は [docs/setup.md](docs/setup.md)、
アプリのビルド方法は [docs/build.md](docs/build.md)、
GitHub での進め方(Issue・Pull Request・リリース)は [docs/github-workflow.md](docs/github-workflow.md)、
画面の文言の管理は [docs/i18n.md](docs/i18n.md) にあります。
構造の詳しい説明は [docs/architecture.md](docs/architecture.md) にあります。

## 1. 環境をそろえる

| 用途                                   | 必要なもの                                                                                |
| -------------------------------------- | ----------------------------------------------------------------------------------------- |
| 編集・型チェック・整形(どの OS でも可) | Node.js 22 以上、Rust(`rustup`。`x86_64-pc-windows-msvc` ターゲット、`clippy`、`rustfmt`) |
| 実行・テスト・インストーラ作成         | **Windows 10/11**(Win32 / WebView2 を使うため)、Visual Studio Build Tools(C++)、WebView2  |

WSL2(Ubuntu)で編集して、Windows で実行する進め方もできます。WSL では次のようにして、Windows 向けとして検査できます。

```bash
npm ci
cd src-tauri && cargo clippy --target x86_64-pc-windows-msvc -- -D warnings
```

VS Code を使う場合は、フォルダを開くと「おすすめの拡張機能」が案内されます(`.vscode\extensions.json`)。`miniapp.json` / `widget.json` は、`schemas\` のスキーマで入力補完されます。

## 2. よく使うコマンド

| やりたいこと                                            | コマンド                                       |
| ------------------------------------------------------- | ---------------------------------------------- |
| 画面だけをブラウザで確認(Rust なし。保存などは疑似動作) | `npm run dev` → http://localhost:1420          |
| アプリを起動(Windows)                                   | `npm run tauri dev`                            |
| **提出前の確認(まとめて)**                              | `npm run check`                                |
| 整形する                                                | `npm run format` / `cargo fmt`(`src-tauri` で) |
| 画面のテスト(Vitest)                                    | `npm test`                                     |
| Rust のテスト                                           | `cargo test`(`src-tauri` で)                   |
| インストーラーだけを作る(Windows)                       | `.\scripts\release.ps1`                        |
| インストーラーと、ポータブル版の zip を作る(Windows)    | `.\scripts\release.ps1 -Zip`                   |
| インストーラーと、オフライン版を作る(Windows)           | `.\scripts\release.ps1 -Offline`               |

作ったものは、`release\` に集まります(`AlumiLauncher_Setup.exe`・`AlumiLauncher_Portable.zip`・`AlumiLauncher_Setup_Offline.exe`)。配布するとき(GitHub の Releases に載せるとき)は、`-Zip` を付けて、インストーラーと zip の両方を作ります。詳しくは [docs/build.md](docs/build.md) を見てください。

`npm run check` は、`tsc`(型)、ESLint、Prettier、ミニアプリ・ウィジェットの検査(`check:miniapps`。JSON・ファイルの有無・JavaScript の文法)、その JavaScript の名前の書き間違いの検査(`check:js`)、画面のテスト(Vitest)を実行します。依存ライブラリ(`package.json`・`Cargo.toml`)を足す・更新したら、`npm run licenses` で `THIRD_PARTY_LICENSES.md` を作り直してください(Rust のソースを取得してある環境で実行します)。画面のテストには、axe-core でアクセシビリティを調べるもの(`src/launcher/App.a11y.test.tsx`。ホーム・設定・フォルダ・「＋」のメニュー)も入っています。ボタンにラベルが無い、ダイアログに `role="dialog"` が無い、などは、ここで見つかります(色のコントラストは、jsdom では計算できないので、対象外です)。新しい画面を足したら、このテストにも足してください。Rust は別に `cargo fmt --check` と `cargo clippy -- -D warnings` を通してください。

## 3. どこを触るか(3 つの領域)

開発は、次の 3 つの領域に分かれています。**やりたいことの領域だけを触れば済む**ように作ってあります。

```
src/
 ├ app/         ① ランチャー本体(機能ごと)  ← 本体を直す・育てるときは、ここだけ
 │   ├ App.tsx / main.tsx  入口と、全体の組み立て
 │   ├ modules/    機能ごと(shell・home・folders・history・settings・widgets・miniapps・start-apps・icons・plugins)
 │   └ shared/      機能をまたぐ部品(api・ui・drag・audio・i18n・styles・lib)
 ├ miniapps/    ② ミニアプリ(1 フォルダ = 1 アプリ)  ← ミニアプリを作る・直すときは、ここだけ
 │   └ <id>/        miniapp.json / icon.svg / view/ / controller/ …(下記)
 └ widgets/     ③ ウィジェット(1 フォルダ = 1 つ)  ← ウィジェットを作る・直すときは、ここだけ
     └ <id>/        widget.json / icon.svg / index.tsx / view/ / model/ / i18n.ts …(下記)
```

### ② ミニアプリを作る・直す(`src/miniapps/<id>/` だけ)

```
src/miniapps/<id>/
 ├ miniapp.json       名前・説明・権限・入口(entry は view/index.html)
 ├ icon.svg
 ├ view/              画面: index.html と style.css
 ├ controller/        動き: main.js(画面の JavaScript。大きくなったら、役割ごとに、複数のファイルに分けて、index.html に `<script>` を、読み込む順に並べる)
 ├ model/             (任意)データを扱う部分
 ├ widgets/<名前>/    (任意)このミニアプリのウィジェット(widget.json)
 └ index.tsx          (任意)ランチャーの画面側の部分(下記)
```

- `miniapps/_examples/template-app/` をコピーして `<id>` に名前を変えるだけで、新しいミニアプリになります。**Rust にも本体にも、書き足すものはありません**(同梱するかどうかも、フォルダがあれば自動です)。
- ふつうのミニアプリは、`view/` と `controller/` だけです(sandbox の iframe の中で動きます)。ランチャーの機能は、`miniapp.json` の `permissions` に書いたものだけ、`postMessage` で使えます。
- **ランチャーの画面側にも部品が要るとき**(例: ミュージックは、ミニアプリを閉じても曲が鳴り続けるので、プレーヤーの本体をランチャー側に持つ)だけ、`index.tsx` を置きます。`controller/`・`view/`・`i18n.ts` も、ミニアプリのフォルダの中に置きます。`index.tsx` の既定の書き出し(`definePlugin({ ... })`)は、ランチャーが**自動で見つけて**使います。
  - `widgets` … ウィジェットの部品(`widget.json` の `builtin` と同じ名前で登録)
  - `bridges` … ミニアプリが `postMessage` で呼べるランチャー側の機能(例: `player.*`)
  - `hooks` … 起動時・音量の変更・データを消したあとに呼ばれる関数
- 例: `miniapps/music/`(`controller/PlayerController.ts`・`Playlists.ts`・`PlayerBridge.ts`、`view/MusicWidget.tsx`、`index.tsx`)

### ③ ウィジェットを作る・直す(`src/widgets/<id>/` だけ)

- ランチャーの画面の中で動く React の部品にするときは、`widget.json` に `"builtin": "<id>"` を書き、`index.tsx` で `definePlugin({ widgets: { <id>: { component, cells } } })` を渡します(例: `widgets/todo/`)。
- 小さな HTML だけで作るときは、`widgets/_examples/template-widget/` をコピーします(`widget.json` と `view/index.html`)。
- 文言は、そのフォルダの `i18n.ts`(`defineMessages(日本語, 英語)`)に持ちます。ウィジェットの名前・説明・アイコンは、`widget.json` と `icon.svg` に書きます(ランチャーの文言表には足しません)。
- 複数のウィジェットで使う部品は、`widgets/common/` に置きます。

### ① ランチャー本体を直す(`src/launcher/` だけ)

| やりたいこと               | 触る場所                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 文言を変える・言語を足す   | `src/launcher/shared/i18n/messages.ja.ts` と `messages.en.ts`                                                                                                                                                                                                                                                                                                                                                                         |
| 見た目を変える             | `src/launcher/shared/styles/`(入口は `styles.css`。機能ごとのファイルを、順番に読み込みます。**読み込む順番が、規則の優先の順番**なので、順番を変えないでください。ウィジェット固有の CSS は、そのウィジェットの `view/style.css`)                                                                                                                                                                                                    |
| ホーム・フォルダ・設定     | `src/launcher/modules/home/`・`folders/`・`settings/`・`shell/`(処理は、フック `use〜` に書く。`src/launcher/App.tsx` は、それをつなぐだけ)                                                                                                                                                                                                                                                                                           |
| ウィジェットの欄・追加画面 | `src/launcher/modules/widgets/`(`WidgetBar.tsx`・`WidgetPicker.tsx`)                                                                                                                                                                                                                                                                                                                                                                  |
| ミニアプリの窓口           | `src/launcher/modules/miniapps/miniapp.tsx`                                                                                                                                                                                                                                                                                                                                                                                           |
| 画面から Rust の機能を呼ぶ | `src-tauri/src/` の、合う機能のフォルダ(`config/`・`files/`・`extensions/`・`window/`・`platform/`)に `#[tauri::command]` を足して `lib.rs` の `generate_handler!` に並べ、`src/launcher/shared/api/` に、型(`ApiTypes.ts`)・呼び出し(合う領域のファイル。`ApiApp`・`ApiWindow`・`ApiFiles`・`ApiExtensions`・`ApiMedia` のどれか。`api.○○()` で呼べるよう、`ApiModel.ts` が、まとめます)・ブラウザ確認用のダミー(`ApiMock.ts`)を足す |
| ミニアプリに新しい権限     | `schemas/miniapp.schema.json`(権限の名前。Rust は、ビルドのときに、これを読みます)に足し、`src/launcher/modules/miniapps/miniapp.tsx`(窓口)で実装する(足し忘れは、テストが知らせます)                                                                                                                                                                                                                                                 |

**境界の決まり**: `src/launcher` は、個々のミニアプリ・ウィジェットを名前で読み込みません(ESLint が検査します)。ミニアプリ・ウィジェットの部品は、`PluginRegistry`(`src/launcher/modules/plugins/`)が、フォルダの `index.tsx` から自動で集めます。ミニアプリ・ウィジェット側から `src/launcher` の部品(`shared/` の `ApiModel`・`AppDataModel`・`lib/` など)を使うのは構いません。

同梱するミニアプリ・ウィジェットの一覧と「版」は、ビルド時に `src-tauri/build.rs` が、フォルダの中身から作ります(内容が変わると、版が自動で変わり、次の起動で書き換わります。**版を手で上げる必要はありません**)。

## 4. 書き方の決まり

- 整形・検査は、設定ファイルがルールです(`.editorconfig` / `.prettierrc.json` / `eslint.config.js` / `src-tauri/rustfmt.toml`)。迷ったら `npm run format` と `cargo fmt` に任せます。
- 関数・定数・型には、**日本語の説明コメント**を付けます(TypeScript は JSDoc、Rust は `///`)。
- 文字コードは UTF-8、改行は LF です(`.ps1` だけ BOM 付き)。
- 画面の文言は、ランチャー本体は `i18n.ts`、ミニアプリ・ウィジェットは自分のフォルダの文言を通します(直書きしません)。
- ミニアプリ・ウィジェットは、本体から独立させます。本体の内部は触らず、`postMessage` の窓口と `permissions`、`definePlugin` だけを使います。

## 5. 確認のしかた(提出前のチェックリスト)

1. `npm run check` が通る
2. `cargo fmt --check` / `cargo clippy -- -D warnings` / `cargo test` が通る(Rust を触ったとき)
   - 画面側のロジックを足したら、`*.test.ts(x)` も足す(`npm test`)
3. `npm run dev` で、触った画面を見る(Windows 固有の機能は、`npm run tauri dev` で見る)
4. アプリの画面の文言を変えたなら、日本語・英語の両方を直した(アプリの表示言語は、日本語と英語に対応しています)
5. ユーザー向けの動きが変わったなら、`README_JP.md` も直した

> `npm run dev` のブラウザ確認では、Windows 固有の機能(ドラッグアウト、サムネイル、WebView2 など)は動きません。それらは実機(Windows)でだけ確認できます。確認していない部分は、提出時にその旨を書いてください。
