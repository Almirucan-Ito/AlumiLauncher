# src-tauri/src(ランチャー本体の Rust)

画面(`src/`)から呼ばれるコマンドと、Windows の機能を受け持ちます。画面は WebView2 の中の React で、ここは、その外側です。
全体の図は `docs/architecture.md`、各フォルダの役割は、そのフォルダの `README.md`。

## 構成

| 場所 | 役割 |
| --- | --- |
| `lib.rs` | 入口(`run`)。プラグイン・`widget` / `miniapp` プロトコル・**コマンドの登録(`generate_handler!`)**・ウィンドウのイベント・起動時の初期化をまとめる |
| `startup.rs` | 起動時の初期化(データの準備・設定の読み込み・トレイ・ウィンドウの位置と大きさ・ショートカットの登録) |
| `state.rs` | アプリ全体で共有する状態 `AppState`、ロックの補助 `lock_ok` |
| `protocols.rs` | `widget://` と `miniapp://` の配信(画面の `<iframe>` が読むファイル) |
| `logging.rs` | 記録(ログ)。この PC の中だけに置く |
| `config/` | 設定ファイル(型・保存・検査) |
| `files/` | フォルダとファイルの操作(一覧・移動・名前の変更・削除・起動) |
| `extensions/` | ミニアプリ・ウィジェット(一覧・同梱・データ・音楽/画像の登録・Web ミニアプリ) |
| `window/` | ウィンドウの表示・ショートカットキー・トレイ・デスクトップモード |
| `platform/` | Windows のシェルの機能(アイコン・ドラッグ・スタートメニュー・ごみ箱) |
| `tests/` | 複数のモジュールにまたがるテスト(各モジュールの中の `#[cfg(test)]` もある) |

## 担当すること / しないこと

- 担当する: ファイルへの書き込み、Windows の機能(Win32・シェル)、画面が直接はできないことすべて。
- しない: 画面の見た目・状態(`src/launcher`)。文言のほとんど(トレイのメニューと初期フォルダの名前だけ、Rust 側で `platform/locale.rs` を見て選ぶ)。

## 設計の理由

- **画面からのコマンドは、「登録したフォルダの中」にしか触れない**: 実行・削除・名前の変更・読み取りは、`files/roots.rs` の `in_registered` を通す
  (リンクを使った抜け道も、正規化して防ぐ)。ドライブ直下と Windows のフォルダは、登録できない(`is_allowed_folder`)。
- **ミニアプリ・ウィジェットは、画面から切り離して動かす**: `<iframe sandbox>` の中で、`widget://` `miniapp://` のファイルだけを読む。
  外部との通信は、`"network": true` を宣言し、利用者が同意したものだけ(`extensions/widgets/protocol.rs` が CSP を組み立てる)。
- **設定はメモリ上に持ち、ディスクへは、まとめて書く**(`config/store.rs`): 画面からの保存は即時にメモリを更新し、書き込みは 120ms にまとめる。
  書き込みは、一時ファイルに書いてから置き換える(書き込み中に落ちても、設定ファイルが壊れない)。
- **`Mutex` のロックは `.lock().unwrap()` ではなく `lock_ok()`**(`state.rs`): 別のスレッドが落ちて、ロックが「毒化」しても、アプリごと落ちないように。
- **リリースビルドは `panic = "abort"`**(`Cargo.toml`)。パニックは、記録(ログ)に残す(`logging.rs`)。`unwrap()` は避け、失敗は `Result` や `log_err` で扱う。
- **`unsafe` の箇所には、安全である理由を、`// SAFETY:` で書く**。
- **ウィンドウは、画面の用意ができてから出す**(`AppState.ready` / `want_show`): 起動時のアイコンの表示が乱れないように。
- **画面と同じにしておく値がある**: ホームの並びのキー `HOME_ORDER_KEY`(`files/listing.rs`)、設定の項目の名前(`config/model.rs` の `Settings`)。
  画面側の `shared/api/rust-sync.test.ts` が、この Rust のソースを読んで、ずれを知らせる。

## 新しいコマンドを足すとき

1. 該当するモジュールに、`#[tauri::command] pub async fn …` を書く(ファイルの操作は、`in_registered` で、触ってよい場所かを確かめる)。
2. `lib.rs` の `generate_handler!` に登録する。
3. 画面側の `src/launcher/shared/api/` に、窓口を足す(`isTauri` でないときのダミーも)。
4. テストを足す(`cargo test`。ファイルの操作は `tests/files.rs` を参考に)。
5. 実機でしか確かめられないものは、`docs/manual-test.md` に足す。

## 確かめ方

- `cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings`
- `cargo test` は Windows で行う(WSL からは、`cargo clippy --target x86_64-pc-windows-msvc -- -D warnings` までできる)。環境の作り方は `docs/setup.md`、ビルドは `docs/build.md`。
