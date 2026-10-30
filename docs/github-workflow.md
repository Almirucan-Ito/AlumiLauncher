# GitHub での運用(Issue・PR・リリース)

GitHub に公開したあと、どう運用するかの方針です。個人で始めるプロジェクトを想定して、**無理なく続けられる最小限**にしてあります。人が増えたら、見直します。

## 1. どこに何を書くか(窓口)

| 内容                                   | 場所                                                                                                |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| バグ(動かない・おかしい)               | **Issues** →「バグの報告」のテンプレートを使う                                                      |
| 新しい機能・改善の希望                 | **Issues** →「機能の要望」のテンプレートを使う                                                      |
| 使い方の質問・相談・アイデアの話し合い | **Discussions**(有効にしておく)。無ければ、Issue に `question` ラベル                               |
| **セキュリティの問題(脆弱性)**         | 公開の Issue には**書かない**。**Security → Report a vulnerability**([SECURITY.md](../SECURITY.md)) |
| コードの修正の提案                     | **Pull Request**(下の「5」)                                                                         |

### バグを報告するとき(報告する人へ)

テンプレートの項目を埋めてください。次の情報があると、すぐ直せます。

- AlumiLauncher の**バージョン**(設定の一番下。インストーラー版かポータブル版かも)
- Windows の**バージョン**(`winver` で分かります)
- **再現の手順**(何をして、何が起きたか。できれば、毎回起きるか)
- **ログ**: `%AppData%\AlumiLauncher\logs\alumi.log`(エクスプローラーのアドレス欄に貼り付けると開けます)。**ファイルのパスなどが入ることがある**ので、中身を確かめてから添付してください(この PC の外には送られません)
- 画面の様子(スクリーンショット)

## 2. 新しく開発に入る人へ

1. [README_JP.md](../README_JP.md) でアプリを知る → [setup.md](setup.md) で環境をつくる
2. [CONTRIBUTING.md](../CONTRIBUTING.md) で「どこを触るか」「書き方」を読む
3. Issue の中から、`good first issue`(初めての人向け)・`help wanted`(手伝ってほしい)ラベルのものを選ぶ。やりたいことが決まったら、**Issue に「やります」と書く**(同じものを、二人で作らないため)
4. 大きな変更(新機能・構造の変更)は、**作る前に Issue で相談**してください(作ったあとに、方針が合わず、取り込めないことを避けるため)
5. リポジトリを **fork** して、ブランチを作り、変更して、Pull Request を出す

ミニアプリ・ウィジェットだけを作りたい人は、本体のコードを触らずに済みます。[extending.md](extending.md) だけ読めば始められます。

## 3. ブランチとコミット

長く残るブランチは、次の 2 つだけです。

- `main` … 公開する版。いつも動く状態にしておく。**直接は書き込まない**(Pull Request だけ)。リリースのタグは、ここに打つ
- `develop` … 開発の本線。**直接は書き込まない**(Pull Request だけ)。作業用のブランチは、ここから作る

作業用のブランチは、`develop` から作り、取り込まれたら**削除**します(ローカルもリモートも)。

- `feature/<内容>` … 機能の追加
- `fix/<内容>` … バグの修正
- (`docs/<内容>` … 文書だけの変更)

流れは、次のとおりです。

```
develop ─┬─ feature/xxx ──PR→ develop      (1. 機能・修正を develop に取り込む)
         └─ fix/yyy     ──PR→ develop
develop ──────────────────PR→ main         (2. ある程度、問題ないと判断したら、main に取り込む)
```

1. `develop` から `feature/…` か `fix/…` を作り、変更して、`develop` 宛ての Pull Request を出す。**公開したあとは、レビューが 1 人必要**(公開するまでは、不要)。
2. `develop` で、ある程度、問題ないと判断したら、`develop` から `main` 宛ての Pull Request を出す。こちらも**公開したあとは、レビューが 1 人必要**(公開するまでは、不要)。
3. 取り込み方:
   - 作業用のブランチ → `develop` は **Squash and merge**(1 つの Pull Request = 1 つのコミットにまとめて、履歴を読みやすくする)
   - `develop` → `main` は **Create a merge commit**。Squash にすると、`develop` と `main` の履歴が食い違い、次の Pull Request で、同じ差分が出続けるため。
4. `main` に取り込んだあと、`main` を `develop` に戻す必要は、ありません(merge commit にしているため)。

- コミットのメッセージ: 1 行目に「何をしたか」を短く(日本語で構いません)。必要なら、空行のあとに理由を書く

## 4. ラベル

| ラベル                              | 意味                                                   |
| ----------------------------------- | ------------------------------------------------------ |
| `bug` / `enhancement` / `question`  | 種類(バグ / 要望 / 質問)                               |
| `good first issue` / `help wanted`  | 初めての人向け / 手伝ってほしい                        |
| `miniapp` / `widget` / `core`       | 触る領域(ミニアプリ / ウィジェット / 本体)             |
| `windows-only`                      | Windows の実機でしか確認できない                       |
| `needs-repro`                       | 再現の手順が足りない(報告者に、聞いている)             |
| `docs`                              | 文書                                                   |
| `duplicate` / `wontfix` / `invalid` | 重複 / 対応しない / 当てはまらない(理由を書いて閉じる) |

## 5. Pull Request

- 出し先(base)は、作業用のブランチなら **`develop`**、リリース前の取り込みなら **`main`** です。間違えやすいので、出す前に確かめてください。
- **公開したあとは、レビュー(承認)が 1 人必要**です(公開するまでは、不要。自分で取り込んで構いません)。自分の Pull Request は、自分では承認できません。レビューする人がいないあいだは、ブランチ保護の「管理者は例外にする」を許すか、協力者を 1 人入れます(後の「8」を参照)。
- テンプレート(`.github/pull_request_template.md`)のチェックを埋めます。
- **CI(GitHub Actions)が通ること**が条件です。CI は、`npm run check`・`cargo fmt --check`・`cargo clippy -- -D warnings`・`cargo test` を、Windows で実行します。
- 画面を変えたときは、変更前後のスクリーンショットを貼ってください。
- 実機でしか確認できないところ(ドラッグアウト・デスクトップモードなど)で、**確認できていないことは、正直に書いてください**。
- レビューは、お互い敬意を持って、コードについてだけ話します([CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md))。返事は、**1 週間以内を目安**にします(できないこともあります)。

### ミニアプリ・ウィジェットを取り込む基準

- 外部との通信は、原則しません。必要なときは `"network": true` を宣言し、理由を説明に書く(アプリは、通信しないことを特長にしているため)
- `permissions` は、必要最小限にする
- 他人の著作物(画像・音・コード)を、許可なく入れない。使うなら、ライセンスを明記し、`THIRD_PARTY_LICENSES.md` に反映する
- 規約・利用許諾に反するもの(他社サービスを、許可なく操作するものなど)は、取り込めません

## 6. バージョンとリリース

- バージョンは **SemVer**(`MAJOR.MINOR.PATCH`)。バグ修正だけなら PATCH、機能追加は MINOR、互換のない変更は MAJOR を上げます。
- 変更の記録は [CHANGELOG.md](../CHANGELOG.md) に、リリースごとに書きます(利用者に見える変更だけ)。
- リリースの手順:
  1. `develop` から `main` への Pull Request を出して、CI が通ったら、取り込む(公開したあとは、レビューも受ける)
  2. バージョンを上げる(`package.json`・`src-tauri/Cargo.toml`・`src-tauri/tauri.conf.json` の 3 か所)
  3. [manual-test.md](manual-test.md) を、実機で通す
  4. `npm run licenses`(依存が変わったとき)、`CHANGELOG.md` を更新する
  5. `vX.Y.Z` のタグを打って、GitHub に送る(`main` の最新に打つ。タグは、手順 2 のバージョンと同じにする)

     ```bash
     git tag vX.Y.Z
     git push origin vX.Y.Z
     ```

  6. **あとは、自動です**(`.github/workflows/release.yml`)。GitHub の Windows のサーバーが、検査・テスト・ビルド(`.\scripts\release.ps1 -Zip` と同じ)をして、`AlumiLauncher_Setup.exe` と `AlumiLauncher_Portable.zip` を、**下書き**の Release として載せます。リリースのメモは、`CHANGELOG.md` の、その版の部分に、SmartScreen の案内を足したものが、自動で入ります。
  7. GitHub の Releases で、下書きの中身(メモ・ファイル)を確かめて、**「Publish release」** を押すと、公開されます。
  - タグの版と、3 か所のバージョンが、違うときは、ビルドの前に止まります(違う版のインストーラーを作らないため)。
  - タグを打たずに試すときは、GitHub の「Actions」タブ → 「Release」→ 「Run workflow」を押します。ビルドだけして、できたファイルを「Artifacts」に置きます(Releases には載せません)。
  - 失敗したときは、Actions のログを見て、直してから、タグを打ち直します(`git tag -d vX.Y.Z` と `git push origin :refs/tags/vX.Y.Z` で、タグを消せます)。
  - 手元でビルドして、手で載せることも、できます([build.md](build.md))。

## 7. セキュリティ・依存ライブラリ

- 脆弱性の連絡は、[SECURITY.md](../SECURITY.md) のとおり、非公開で受けます。
- **脆弱性の検査**(`.github/workflows/audit.yml`)が、`cargo audit` と `npm audit` で、使っているライブラリに既知の脆弱性がないかを、毎週月曜と、依存を変えたときに調べます。脆弱性が見つかると失敗します(「メンテナンスされていない」などの警告だけなら、失敗しません)。見つかったら、該当のライブラリを更新します。
- **Dependabot**(`.github/dependabot.yml`)が、依存の更新の Pull Request を出します。CI が通れば取り込み、依存が変わったら `npm run licenses` を実行します。
- リポジトリの設定で、**Secret scanning** と **Push protection**(鍵・トークンの誤公開の防止)を有効にします。

## 8. 公開前のチェックリスト(1 回だけ)

- [ ] **履歴に、公開しないもの(他社のサービスのテスト用ミニアプリ、個人情報など)が残っていない**(`git log --all -i -S"<探す文字>"` で確かめる)
- [ ] `LICENSE`(MIT)・`THIRD_PARTY_LICENSES.md` がある
- [ ] README に、スクリーンショットと、ダウンロードの案内がある
- [ ] Issue のテンプレート・`SECURITY.md`・`CODE_OF_CONDUCT.md` がある(このリポジトリに用意済み)
- [ ] リポジトリの設定: 説明・Topics(`launcher`・`windows`・`tauri`・`react`)を入れる / Discussions を有効にする / **`main` と `develop` のブランチ保護**(Pull Request を必須・**承認 1 人を必須**・CI の成功を必須・force push 禁止・直接 push 禁止。Settings → Branches → Add branch ruleset)/ Secret scanning。**非公開のリポジトリでは、無料のプランだと、ブランチ保護は使えません**(公開すると使えます)
- [ ] ラベルを作る(上の「4」)
- [ ] `docs/manual-test.md` を実機で通した
- [ ] 初回リリース(`v1.0.0`)を作る

## 9. 将来の課題

- コード署名(SmartScreen の警告をなくす。証明書が必要)
- 自動更新(いまは、利用者が、新しいインストーラーを入れ直す)
