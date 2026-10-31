# styles(ランチャー本体の CSS)

ランチャー本体の見た目を決める CSS です。入口は `styles.css`(`main.tsx` が 1 回だけ読み込む)。
ウィジェットやミニアプリの中身の CSS は、それぞれの `view/style.css` にあり、ここには書きません。

## 担当すること / しないこと

| 担当する | 担当しない |
| --- | --- |
| ホーム・フォルダ・メニュー・ダイアログ・設定・ウィジェットの欄と枠、など、ランチャー本体の見た目 | 各ウィジェットの中身(`src/widgets/*/view/style.css`)・ミニアプリの中身(`src/miniapps/*/view/*.css`) |
| 色の「変数」の定義(背景のテーマ・UI の色) | 色の選び方の決まり(`modules/shell/AppLookModel.ts` が `.app` のクラスを、`modules/settings/ThemeModel.ts` が `--accent` `--ui-alpha` などの値を、決める) |

## ファイルの役割

| ファイル | 中身 |
| --- | --- |
| `theme.css` | 背景のテーマの変数だけ(グレー・ダーク・ホワイト・アクセント・好きな色・画像・クリア) |
| `ui-colors.css` | UI の色の変数だけ(`--btn`・`--clock`・`--card-fill` など)。セレクタで部品を指定しない |
| `base.css` | リセット・ウィンドウ本体(`.app`)・タイトルバー・トップ/ボトムの帯・ホーム |
| `pager.css` | ページ送り(`.page`・`.cell` の状態・ドラッグ中のアイコン・矢印・点) |
| `tiles.css` | アイコン 1 つ(`.tile`・`.plate`・`.label`) |
| `folders.css` | 開いたフォルダ(`.overlay`・`.sheet`)。フォルダ内の矢印の大きさもここ |
| `controls.css` | 右下の丸ボタンと、左上のプリセット |
| `settings.css` | 設定パネル |
| `dialogs.css` | ダイアログの共通の枠・ボタン |
| `menus.css` | トースト・右クリックメニュー |
| `widgets.css` | ウィジェットの欄(`.wbar`)・枠(`.widget`)・追加の画面 |
| `clock.css` | 時計のウィジェット |
| `widget-contents.css` | ウィジェットのカード(`.wcard`)など、各ウィジェットに共通の部分 |
| `miniapps.css` | ミニアプリを開いている間の画面 |
| `compact.css` | とても小さいウィンドウ(高さ 200px 未満)のときの上書き |
| `desktop-mode.css` / `start-apps.css` | デスクトップモード・スタートメニューから追加の画面 |

## 決まり(これを守ると、見た目が追いやすい)

1. **1 つの部品の規則は、1 つのファイルに集める。** 同じセレクタを、別のファイルで足して書かない
   (以前は `widget-layers.css` に「あとから重ねた調整」を集めていて、`.plate`・`.widget`・`.wcard` などが、2〜3 か所に分かれていた)。
2. **色は変数で決める。** 部品の CSS は、`var(--btn)` `var(--clock)` `var(--card-fill)` のように変数を使うだけにして、
   UI の色ごとの場合分け(`.ui-dark .round { … }`)を、部品側に書かない。場合分けは `theme.css` と `ui-colors.css` だけ。
3. **「上書き」を避ける。** 先に書いた値を、あとのファイルで打ち消すより、元の規則を直す。
   上書きが必要なときは、理由をコメントに書く。
4. **`!important` は、2 か所だけ**:
   - `base.css` の「動きを減らす」設定(どの規則よりも優先させるため)
   - `widgets.css` の `.widget.hfixed > .wmod { height: 100% !important }`(追加のウィジェットの高さを、JS が style 属性に px で書くため)
5. 1 ファイルは 400 行以内。

## 規則の強さと、読み込む順番

- 規則の強さは、まず **セレクタの強さ**(クラスの数)で決まる。**同じ強さのときだけ、あとに読み込んだほうが勝つ。**
  `styles.css` の `@import` の順番が、その「あと」です。順番を変えると、見た目が変わることがあります。
- 順番に頼っているのは、次の所だけです(ここを触るときは、順番に注意)。
  - `theme.css`: `.app.theme-gray` は、`.app.is-light` と同じ強さなので、あとに置いて勝たせている。
  - `pager.css` と `tiles.css`: 重ねて離す相手の枠(`.cell.merge .plate`)は、単独アイコン(`.tile.bare .plate`、枠を消す)と同じ強さ。
    `tiles.css` のほうがあとなので枠が消え、`tiles.css` の `.cell.merge .tile.bare .plate`(1 段強い)で付け直している。
  - `compact.css`: 小さいウィンドウの上書き(`.app.compact …`)は、すべて他より強い(クラス 3 つ以上)ので、順番には頼らない。
    ただし最後のほうに置いて、読み手に「上書きだ」と分かるようにしている。
- ウィジェットの `view/style.css` は、それぞれのウィジェットを最初に表示するとき(`import "./style.css"`)に読み込まれ、
  `styles.css` より **あと** になります。ランチャー本体の規則と同じ強さなら、ウィジェット側が勝ちます。
  本体の規則を打ち消したいときは、セレクタを 1 段強くして、理由をコメントに書く
  (例: `src/widgets/shortcuts/view/style.css` の `.widget.hfixed > .wcard.wshortcuts`)。

## 変更したときの確かめ方

- `npm run check`(書式を含む)。CSS の見た目には、自動のテストがありません。
- ブラウザの疑似データ(`npm run dev`、`http://localhost:1420`)で、ホーム・フォルダ・設定・右クリック・ダイアログ・
  ウィジェットの追加画面を、背景のテーマと UI の色を変えながら見る。
- 実機での確認項目は `docs/manual-test.md`。
