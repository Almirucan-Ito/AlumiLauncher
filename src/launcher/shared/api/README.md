# shared/api(Rust との通信と、保存データ)

画面から Rust 側(`src-tauri`)を呼ぶ窓口と、その型・初期値・ブラウザ確認用のダミーを持ちます。

## 担当すること

- **窓口 `api`**(`ApiModel.ts`): 領域ごとのファイル(`ApiApp`・`ApiWindow`・`ApiFiles`・`ApiExtensions`・`ApiMedia`)を 1 つにまとめたもの。呼ぶ側は `api.○○()` と書く。
- **型と設定の初期値**(`ApiTypes.ts`): `Config`・`Settings`・`DEFAULT_SETTINGS` など。Rust の型(`config/model.rs` など)と同じ形。
- **補助**(`ApiHelpers.ts`): Tauri の中かどうかの判定(`isTauri`)・Rust のコマンドの呼び出し(`invoke`)・ウィジェットの ID と表示名・外部通信の同意のキー。
- **ブラウザ確認用のダミー**(`ApiMock.ts`): Tauri の外(`npm run dev`)で、見た目だけを確かめるためのデータと関数。
- **ミニアプリ・ウィジェットの保存データ**(`AppDataModel.ts`): 読み込んだ内容を覚えて(同期で読める)、書き込みは、少しまとめてからファイルへ書く。
- **ドラッグの感度**(`TuningModel.ts`): 重ねる範囲・待つ時間・ページ送りの距離などの数値。

## 担当しないこと

- コマンドの中身(Rust の `config/`・`files/`・`extensions/`・`window/`・`platform/`)。ここは、呼ぶだけ。
- 画面の状態の管理(`modules/*`)。

## 設計の理由

- **窓口を 1 つ(`api`)にして、領域ごとのファイルで持つ**: `ApiModel.ts` を大きくしないため。呼ぶ側は、領域を意識しない。
- **Tauri の外では、ダミーを返す**(各メソッドの先頭で `isTauri` を見る): ブラウザだけで、見た目と動きを確かめられる(Windows 固有の機能を除く)。
  ミニアプリ・ウィジェットの一覧は、フォルダの JSON をそのまま読む。
- **Rust と画面で、同じにしておく値がある**: ホームの並びのキー `HOME_ORDER_KEY`、設定の項目の名前(`Settings` ↔ `DEFAULT_SETTINGS`)。
  `rust-sync.test.ts` が、Rust のソースを読んで、ずれを知らせる。値を変えたら、両方を直す。
- **書き込みは、まとめてから書く**(`AppDataModel`、`WRITE_DELAY_MS`): キーごとに、短い間隔で何度も書かない。
  ウィンドウを隠す・閉じるときは、待たずに、すぐ書く。
- **動きの数値は `TuningModel` に集める**: 動きを調整したいときは、ここだけを書き換える。「重ねて待つ」「長押し」の時間は、利用者が設定画面で変えられるので、
  ここには既定値だけがある(本当の既定値は `ApiTypes.ts` の `DEFAULT_SETTINGS`)。

## 新しいコマンドを足すとき

1. Rust 側に `#[tauri::command]` を書き、`src-tauri/src/lib.rs` の一覧に登録する。
2. 該当する領域のファイル(`ApiFiles.ts` など)に、メソッドを足す。`isTauri` でないときのダミーも書く。
3. 型が増えたら `ApiTypes.ts` に足す(Rust の型と同じ形に)。
