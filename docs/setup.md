# 開発環境のつくり方

AlumiLauncher を、自分の PC で動かして、直せるようにするまでの手順です。コマンドは PowerShell(Windows)で書いています。

## 1. 何が要るか

| 用途                                        | 必要なもの                                                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 画面の編集・型の検査・テスト(どの OS でも)  | Node.js **22 以上**(`.nvmrc` の版を推奨)、npm                                                                                               |
| Rust の編集・検査                           | Rust(`rustup`)。版は `rust-toolchain.toml` で固定してあり、フォルダの中で自動で使われます。`x86_64-pc-windows-msvc` ターゲットが必要        |
| アプリの実行・Rust のテスト・インストーラー | **Windows 10 / 11(64 ビット)**、Visual Studio Build Tools(「C++ によるデスクトップ開発」)、WebView2 ランタイム(Windows 11 には入っています) |
| Git                                         | Git for Windows など                                                                                                                        |

画面だけを触るなら、Rust も Visual Studio も要りません(後の「ブラウザで画面だけ確認」)。

## 2. 最初の 1 回

```powershell
git clone https://github.com/<owner>/AlumiLauncher.git
cd AlumiLauncher
npm ci
```

- `npm ci` は、`package-lock.json` のとおりに入れます(`npm install` より確実)。
- Rust は、`cargo` を初めて動かしたときに、`rust-toolchain.toml` の版が自動で入ります。

### Windows に入れるもの(初めてのとき)

```powershell
winget install OpenJS.NodeJS.LTS
winget install Rustlang.Rustup
winget install Microsoft.VisualStudio.2022.BuildTools --override "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

入れたあと、PowerShell を開き直して、入っているか確認します。

```powershell
node -v      # v22 以上(.nvmrc は 24)
npm -v
git --version
rustup show  # フォルダの中で実行すると、rust-toolchain.toml の版が入る
```

`rustup show` は、初回に、指定の版のダウンロードが始まります(数分)。Visual Studio Build Tools が入っているかは、`cargo build` が `link.exe` を見つけられるかで分かります(見つからないときは、「5. 困ったとき」を見てください)。

## 3. 動かす

| やりたいこと                                  | コマンド                                              |
| --------------------------------------------- | ----------------------------------------------------- |
| ブラウザで画面だけ確認(Rust なし・疑似データ) | `npm run dev` → http://localhost:1420                 |
| アプリとして起動(Windows。変更が自動で反映)   | `npm run tauri dev`                                   |
| 提出前の確認(まとめて)                        | `npm run check`                                       |
| Rust のテスト                                 | `cd src-tauri; cargo test`                            |
| インストーラーを作る([build.md](build.md))    | `.\scripts\release.ps1`(`-Zip` でポータブル版 zip も) |

- 初回の `npm run tauri dev` は、Rust のビルドで数分かかります。2 回目からは速くなります。
- すでにインストール版の AlumiLauncher が動いていると、開発中のアプリは、**二重起動を避ける仕組み**で、すぐ閉じてしまいます。先に、トレイから終了してください。
- 開発中のアプリのデータは、通常の `%AppData%\AlumiLauncher` を使います。分けたいときは、exe の隣に `portable.txt` を置くと、その隣の `data` に保存されます(`src-tauri\target\debug\` に置く)。

### ブラウザで画面だけ確認する(`npm run dev`)

- Rust につながらないので、ファイル・フォルダの操作などは、**疑似データ**で動きます(`src/launcher/shared/api/ApiMock.ts`)。
- ドラッグアウト・アイコン・サムネイル・デスクトップモード・トレイなどの Windows の機能は動きません。実機(`npm run tauri dev`)で確認してください。

## 4. エディターの設定

VS Code がおすすめです。フォルダを開くと、「おすすめの拡張機能」が案内されます(`.vscode/extensions.json`)。

- `miniapp.json` / `widget.json` は、`schemas/` のスキーマで、入力補完・エラー表示が効きます。
- 保存時の整形は、Prettier(TypeScript・CSS・JS)と rustfmt(Rust)です。設定は `.editorconfig` / `.prettierrc.json` / `src-tauri/rustfmt.toml` にあります。
- **Dev Containers** でも開けます(`.devcontainer/`)。編集・型の検査・lint・画面のテスト・Rust の検査(Windows 向け)が、コンテナの中で使えます。アプリの実行と Rust のテストは、Windows が必要です。

### WSL(Linux)で編集して、Windows で実行する場合

Linux 側では、Windows 向けの検査まで行えます。

```bash
npm ci
cd src-tauri
cargo fmt --check
cargo clippy --target x86_64-pc-windows-msvc -- -D warnings
```

アプリの実行・`cargo test`・インストーラーの作成は、Windows 側(ソースのコピー)で行います。

## 5. 困ったとき

| 症状                                         | 対処                                                                                            |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `npm run tauri dev` がすぐ終わる・何も出ない | インストール版が動いていないか確認(トレイから終了)。二重起動の防止が働いています                |
| `link.exe` が見つからない                    | Visual Studio Build Tools の「C++ によるデスクトップ開発」が入っているか確認                    |
| Rust のビルドが、とても遅い                  | 初回は数分かかります。ウイルス対策ソフトが `target\` を監視していると遅くなります(除外に入れる) |
| `npm run check` の Prettier が失敗           | `npm run format` で整えます                                                                     |
| ポート 1420 が使われている                   | 別の `npm run dev` が動いています。止めてください                                               |
| ログを見たい                                 | `%AppData%\AlumiLauncher\logs\alumi.log`                                                        |

## 6. 次に読むもの

- [build.md](build.md) … アプリのビルド方法(インストーラー・ポータブル版・オフライン版)
- [CONTRIBUTING.md](../CONTRIBUTING.md) … どこを触るか・書き方の決まり・提出前のチェックリスト
- [architecture.md](architecture.md) … 構造
- [extending.md](extending.md) … ミニアプリ・ウィジェットの作り方
- [github-workflow.md](github-workflow.md) … Issue・PR・リリースの進め方
