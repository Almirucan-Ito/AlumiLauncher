# アプリのビルド方法

AlumiLauncher を、配布できる形(インストーラー・ポータブル版)にビルドする手順です。環境のつくり方は [setup.md](setup.md) を先に読んでください。コマンドは PowerShell(Windows)で書いています。

**ビルドは、Windows でだけ行えます。** WebView2 と Win32 の機能を使うため、Linux・WSL では、インストーラーまで作れません(Linux 側でできるのは、検査まで。[setup.md](setup.md) の「WSL」を参照)。

## 1. 作れるもの

| ファイル                          | 内容                                                                                                 | 作り方                           |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------- |
| `AlumiLauncher_Setup.exe`         | インストーラー(通常版。約 3.5MB)。WebView2 が無い PC でだけ、インストール中に Microsoft から取得する | `.\scripts\release.ps1`          |
| `AlumiLauncher_Portable.zip`      | ポータブル版(インストール不要。解凍して使う。データは、フォルダ内の `data` に保存)                   | `.\scripts\release.ps1 -Zip`     |
| `AlumiLauncher_Setup_Offline.exe` | オフライン版(約 210MB)。WebView2 を同梱するので、インストール中も通信しない                          | `.\scripts\release.ps1 -Offline` |
| `SHA256SUMS.txt`                  | 上のファイルのチェックサム(改ざん・破損の確認用)。自動で作られる                                     | (自動)                           |

作ったものは、リポジトリ直下の `release\` に集まります(`.gitignore` 済みで、Git には入りません)。

## 2. ビルドの前に

1. **コードが検査を通ること**を確認します。

   ```powershell
   npm run check
   cd src-tauri
   cargo fmt --check
   cargo clippy -- -D warnings
   cargo test
   cd ..
   ```

   `cargo test` の結果に `FAILED` が無いことを、必ず確かめてください(失敗したままビルドすると、壊れたインストーラーができます)。

2. **バージョンを上げる**(リリースのときだけ)。次の 3 か所を、同じ値にします。

   | ファイル                    | 場所                     |
   | --------------------------- | ------------------------ |
   | `package.json`              | `"version"`              |
   | `src-tauri/Cargo.toml`      | `[package]` の `version` |
   | `src-tauri/tauri.conf.json` | `"version"`              |

3. 依存が変わったときは、`npm run licenses` で `THIRD_PARTY_LICENSES.md` を作り直します(インストーラーに同梱されます)。

## 3. ビルドする

リポジトリ直下で、次のどれかを実行します。

```powershell
.\scripts\release.ps1            # インストーラーだけ(ふだんは、これで十分)
.\scripts\release.ps1 -Zip       # インストーラー + ポータブル版 zip
.\scripts\release.ps1 -Offline   # インストーラー + オフライン版
```

- 初回は、Rust の部品をすべてビルドするので、PC によっては十数分かかります。2 回目からは、変えた部分だけなので、短くなります(筆者の PC では 1〜2 分)。
- 中では、`npm run tauri build`(= `tsc && vite build` で画面を作り、`cargo build --release` で本体を作り、NSIS でインストーラーにする)を動かしています。スクリプトを使わず、インストーラーだけを作るなら、次のとおりです。

  ```powershell
  npm run tauri build
  ```

  この場合の出力先は、`src-tauri\target\release\bundle\nsis\AlumiLauncher_<版>_x64-setup.exe` です(配布用の名前には、変わりません)。

- 終わると、`release\` の中身と、チェックサムが表示されます。

### スクリプトが実行できないとき

`このシステムではスクリプトの実行が無効になっているため…` と出たら、PowerShell の実行ポリシーが原因です。現在のユーザーだけ、許可します(管理者権限は要りません)。

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

## 4. できたものを確認する

1. チェックサムを確かめます。

   ```powershell
   Get-FileHash .\release\AlumiLauncher_Setup.exe -Algorithm SHA256
   Get-Content .\release\SHA256SUMS.txt
   ```

   2 つの値が、同じなら正常です。

2. **実機で動かします。** インストーラーを実行して、起動できること、ホームの表示、ドラッグ、設定の保存を確かめます。確認する項目は、[manual-test.md](manual-test.md) にあります。
3. ポータブル版は、zip を別の場所に解凍して、`AlumiLauncher.exe` が起動することを確かめます。インストール版が動いていると、二重起動の防止で、すぐ閉じます(先にトレイから終了してください)。

## 5. 配布する(GitHub Releases)

リリースの流れは、[github-workflow.md](github-workflow.md) の「バージョンとリリース」にあります。要点は、次のとおりです。

1. `main` に、取り込み済みであること(`develop` から `main` への Pull Request)。
2. `vX.Y.Z` のタグを打つ。
3. GitHub の Releases で、`AlumiLauncher_Setup.exe`・`AlumiLauncher_Portable.zip`・`SHA256SUMS.txt` を添える。
4. リリースのメモに、`CHANGELOG.md` の該当部分と、SmartScreen の案内を書く。

コード署名はしていないので、初めて実行すると、Windows SmartScreen の警告が出ます(「詳細情報」→「実行」)。署名を付けるときの設定は、`scripts\release.ps1` の冒頭のコメントにあります。

## 6. WSL で編集して、Windows でビルドする場合

ソースを WSL(Linux)で編集して、ビルドだけ Windows で行うときは、ソースを Windows 側のフォルダへコピーしてから、ビルドします。`.git`・`node_modules`・`target`・`dist`・`release` は、コピーしません(Windows 側の物を使います)。

```powershell
$src = '\\wsl$\Ubuntu-24.04\home\<ユーザー名>\workspace\AlumiLauncher'
$dst = 'C:\<ビルド用のフォルダ>\AlumiLauncher'
robocopy $src $dst /MIR /XD .git node_modules dist release target gen
cd $dst
npm ci                      # 初回と、依存を変えたとき
.\scripts\release.ps1
```

- `robocopy` の終了コードは、0〜7 なら成功です(8 以上が失敗)。
- `/MIR` は、コピー先を、コピー元に合わせて**削除もします**。`/XD` で除いたフォルダは、消えません。コピー先を、間違えないでください。
- Windows 側のフォルダは、`git` の管理外にしておくと、ビルド専用として扱えます。

## 7. 困ったとき

| 症状                                                 | 対処                                                                                                                |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `link.exe` が見つからない                            | Visual Studio Build Tools の「C++ によるデスクトップ開発」を入れる([setup.md](setup.md))                            |
| `AlumiLauncher.exe` を上書きできない                 | 動いているアプリを、トレイから終了する。ウイルス対策ソフトが `target\` を監視していると失敗することも(除外に入れる) |
| インストーラーが、`release\` に出ない                | ビルドの途中で止まっています。表示の最初のエラーを見る(`tsc` の型エラーが多い)                                      |
| `npm run tauri build` の途中で、ネットワークのエラー | インストーラーの作成ツール(NSIS)を、初回に取得することがあります。通信できる環境で、やり直す                        |
| ビルドが、とても遅い                                 | 初回は、数分かかります。`target\` を、ウイルス対策ソフトの監視から外す                                              |
| チェックサムが合わない                               | ファイルが、途中で変わっています。作り直す(ビルドのたびに、値は変わります)                                          |
