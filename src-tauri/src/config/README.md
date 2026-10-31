# config(設定ファイル)

設定ファイル `config.json` の型・保存・検査と、それを画面から呼ぶコマンドです。

## 担当すること

- `model.rs`: 型(`Config`・`Settings`・`FolderEntry`・`Usage`・`PresetData`)と、画面に渡す形への変換(`view_of` / `store_view`)、初期設定(`default_config`)。
- `store.rs`: 設定ファイルの場所(通常版 `%AppData%\AlumiLauncher`・ポータブル版 `<exe>\data`)、読み込み、書き込み(遅れて、まとめて)。
- `sanitize.rs`: 範囲外・不正な値を、安全な値に直す(`sanitize_config`)。
- `commands.rs`: 画面から呼ぶコマンド(`load_config`・`save_config`・`set_preset_mode`・`validate_folder`)。

## 担当しないこと

- 設定を変えたときの副作用(ショートカットの登録・最前面・デスクトップモードなど)。画面が、それぞれのコマンド(`window/`)を呼ぶ。
- 起動回数の記録の更新(`files/usage.rs`)。ここは、型と保存だけ。

## 設計の理由

- **ポータブル版かどうかは、exe の隣の `portable.txt` で決める**(`portable_dir`)。あれば、設定・ホーム・ミニアプリ・ウィジェット・ログ・WebView2 のデータが、すべて exe の隣の `data` に入る。
- **書き込みは、遅らせて、まとめる**(`schedule_flush`): ドラッグ中の並べ替えなど、短い間に何度も保存されるため、120ms にまとめる。
  短くしてあるのは、設定を変えてすぐ終了・再インストールされても失わないため。隠す・終了するときは、すぐ書く(`flush_config`)。
- **書き込みは、一時ファイルに書いてから置き換える**(`write_config_file`): 書き込み中に落ちても、設定ファイルが壊れない。
  書けなかったら「保留中」に戻し、記録して、画面へも知らせる(`save-failed`)。
- **壊れた設定ファイルは、`config.json.bak` に退避して、初期設定で起動する**: そのまま上書き保存して、設定を失わないため。
- **プリセット 1 は、従来の形のまま**(`folders` / `orders`)。プリセット 2〜9 は `presets` に入る。画面が持つのは、表示中のプリセットだけ(`view_of`)。
  **プリセットの選択そのもの(`preset` など)は、`save_config` では変わらず、`set_preset_mode` でだけ変わる**。
- **`usage`(起動の記録)は、ディスクには保存するが、画面には渡さない**。上限は `MAX_USAGE`(300 件、古いものから捨てる)。
- **画面から届いた設定は、必ず検査する**(`sanitize_config`): 画面のバグや、手で編集された設定ファイルでも、範囲外の値・登録できない場所のフォルダが、通らないように。
  今つながっていないドライブ上のフォルダなど、存在を確認できないものは、消さずに残す。
- **JSON の名前は、画面と同じ `camelCase`**。足りない項目は、`Default` の値になる(古い設定ファイルでも読める)。

## 設定の項目を足すとき

1. `model.rs` の `Settings` に足す(`Default` の値も)。JSON の名前に `_` を含めない(`#[serde(rename = …)]` か、`camelCase`)。
2. 画面の `src/launcher/shared/api/ApiTypes.ts` の `DEFAULT_SETTINGS` にも、同じ名前で足す(ずれは `rust-sync.test.ts` が知らせる)。
3. 範囲のある値は、`sanitize.rs` で収める。
4. テストは `src-tauri/src/tests/config.rs`。
