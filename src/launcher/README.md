# src/launcher(ランチャー本体の画面)

React + TypeScript の、ランチャー本体の画面です。Rust 側(`src-tauri/src`)とは、`shared/api` を通して話します。
全体の図と、ミニアプリ・ウィジェットとのつなぎ方は `docs/architecture.md`、各フォルダの役割は、そのフォルダの `README.md` にあります。

## 構成

| 場所 | 役割 |
| --- | --- |
| `main.tsx` | 入口。`styles.css` を先に読み、想定外の失敗を記録(ログ)に残し、ブラウザ標準の右クリックメニューを止める |
| `App.tsx` | 全体の組み立て。「何を開いているか」の状態を持ち、`modules/` のフックと部品をつなぐだけ(約 400 行を超えない) |
| `modules/*` | 機能ごとのフォルダ(画面・状態・処理・型が、同じフォルダに集まる) |
| `shared/*` | 機能をまたぐ道具(Rust との通信・部品・文言・スタイルなど) |

## 担当すること / しないこと

- 担当する: ホーム・フォルダ・設定・ウィジェットの欄・ミニアプリの窓口など、利用者が見る画面と、その操作。
- しない: ファイルを直接触ること(必ず `shared/api` 経由で Rust に頼む)。ミニアプリ・ウィジェットの中身(`src/miniapps`・`src/widgets`)を、名前で読み込むこと。

## 依存の向き

```
modules/*  →  shared/*        (機能は、共通の道具を使ってよい)
modules/*  →  modules/*       (できるだけ少なく。使うなら、相手の「Model」「フック」「型」だけ)
shared/*   →  modules/*        ✕ が原則(共通の道具は、機能を知らない)
src/launcher  →  src/miniapps・src/widgets   ✕(名前で読み込まない。つなぐのは modules/plugins だけ)
```

- **ESLint が検査しているのは、最後の 1 つだけ**(`eslint.config.js`)。ほかは、決まりごとで、機械は止めてくれない。
- 今の例外(どれも、必要があって、こうなっている):
  - `shared/ui/IconImg.tsx` は、`modules/icons/IconController` を使う(アイコン画像の部品が、取得とキャッシュを使うため)。
  - 機能どうしでは、`home` ↔ `folders`(並びの記録 `HOME_ORDER_KEY`・フォルダの型)、`widgets` → `home`・`plugins`、
    `shell` → ほぼすべて(`Pickers`・`useStartupRestore` が、各機能をつなぐ要)の依存がある。
- 新しい依存を足すときは、相手の「型」と「Model」を優先し、循環(A → B → A)を増やさない。

## なぜ、こうしているか

- **`App.tsx` に処理を書かない**: 以前は約 750 行あり、何を直すと何が動くのかが分かりにくかった。
  処理は `use〜` のフックに取り出し、フックどうしは、最新の設定(`configRef`)・設定の変更(`mutate`)・通知(`flash`)を、引数で受け渡す。
- **画面を使わない計算は、`〜Model.ts` に分ける**(`HomeModel`・`PagerModel`・`LayoutModel`・`ItemNameModel` など)。
  vitest で直接試せて、画面の描画に依存しない。ドラッグなどの動きは自動のテストが薄いので、計算の部分だけでも固めておく。
- **最新の値を、イベントの中で使う**ときは、`useLatest`(`shared/lib`)の参照を使う。購読を描画のたびにやり直さずに済む。
- **ブラウザだけでも動く**: `shared/api` は、Tauri が無いとき疑似データを返す(`npm run dev` で見た目を確認できる)。

## 新しい機能を足すとき

1. `modules/<機能>/` を作る(または、近い機能のフォルダに足す)。
2. 処理は `use〜.ts` のフックに、計算は `〜Model.ts` に、画面は `.tsx` に書く。
3. Rust を呼ぶ必要があれば、`shared/api` に窓口を足す(Rust 側のコマンドは `src-tauri/src/lib.rs` に登録)。
4. 文言は `shared/i18n` の日本語・英語の両方に足す。
5. `App.tsx` には、フックを呼んで、部品を置くところだけを足す。
