# shared/lib(小さな道具)

画面にも機能にも属さない、小さな関数・フックです。テストは `lib.test.ts` と `useLatest.test.tsx`。

| ファイル | 中身 |
| --- | --- |
| `MathUtil` | `clamp`・`clamp01`(範囲に収める) |
| `FormatUtil` | `pad2`(2 桁にそろえる)・`fmtTime`(秒を時刻の形にする) |
| `PathUtil` | `fileLabel`(パスの最後の名前)・`isMiniShortcut`(`.alumiapp` か) |
| `ColorUtil` | `isLight`(色コードが明るい色か。背景が明るいと、文字色を切り替えるため) |
| `IdUtil` | `newId`(フォルダなどの ID を作る) |
| `LangUtil` | `isJa`(表示言語が日本語か。ブラウザ以外で動かしたときは、日本語として扱う) |
| `MessageUtil` | `formatMessage`(`{名前}` の置き換え)・`defineMessages`(ウィジェット・ミニアプリの `i18n.ts` が使う、日本語と英語の辞書) |
| `ExternalStore` | `useSyncExternalStore` で使う、状態の入れ物の土台(ミュージックの `PlayerController` が使う) |
| `useLatest` | 毎回の描画で、最新の値を入れ直す参照を返すフック |

## 担当しないこと

- 画面の部品・Rust の呼び出し・設定の読み書き(それぞれ `shared/ui`・`shared/api`・`modules/settings`)。
- 特定の機能にしか使わない関数(その機能のフォルダに置く)。

## 設計の理由

- **`useLatest`**: イベントの購読(`window.addEventListener` など)を、描画のたびにやり直さずに、中では、いつも最新の値を使うため。
  購読は、返した参照を読むだけにして、参照そのものは変わらない。ランチャーの多くのフック(キー操作・ドロップ・起動時の復元など)が、この形を使う。
  React Compiler 向けの新しい lint ルールは、この書き方を多用するため、使わない設定にしている(`eslint.config.js`)。
- **`ExternalStore`**: 状態の「写し」を持ち、`emit()` で作り直して購読者へ知らせる。写しは、`emit()` するまで同じ値を返す
  (`useSyncExternalStore` が、描き直しを減らせるように)。
- **ここは、機能を知らない**: `shared/lib` は、ほかの `shared` や `modules` を読み込まない、いちばん下の層。
