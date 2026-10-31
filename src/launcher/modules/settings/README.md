# modules/settings(設定)

設定パネルの画面と、設定を変えたときの副作用(ショートカット・最前面・プリセット・背景画像・スタートアップ)を受け持ちます。

## 担当すること

- **画面**: `SettingsPanel`(全体)。グループごとに `SizeGroup`・`AppearanceGroups`(背景・UI の色・フォルダ画面)・`LayoutGroup`。部品は `SliderRow`・`HotkeyRow`・`ColorRow`(色のコードの入力)・`QuitButton`。
- **設定を変える操作**: `useSettingsActions`(`changeSettings`・`changeHotkey`・`applyPresetMode`・`pickImage`・`changeAutostart`・`resetSettings`)。
- **選択肢と検査**: `SettingsModel`(大きさの候補・テーマの一覧・キー名・色のコードの検査・ショートカットの検査)。
- **足りない項目の補い**: `normalizeSettings`(古い設定ファイルでも、画面が使える形にそろえる)。
- **CSS の変数**: `ThemeModel.themeVarsOf`(設定を、`--accent` `--ui-alpha` `--icon-size` などの値にして、`.app` に渡す)。
- **ツールチップの切り替え**: `useTooltipToggle`。

## 担当しないこと

- 設定の保存そのもの(`shell/useConfigStore` の `mutate` → Rust の `config`)。ここは、`mutate` を呼ぶだけ。
- 色の「見た目」(CSS)。ここは、値を決めて渡すだけで、色の場合分けは `shared/styles/theme.css`・`ui-colors.css` にある。
- `.app` のクラス名(`shell/AppLookModel`)。

## 設計の理由

- **設定の項目を足すときは、Rust と画面の両方に足す**: Rust の `config/model.rs` の `Settings` と、画面の `ApiTypes.ts` の `DEFAULT_SETTINGS`。
  名前のずれは、`shared/api/rust-sync.test.ts` が知らせる(JSON の名前は、`_` を含まない形)。範囲のある値は、Rust の `config/sanitize.rs` でも検査する。
- **設定を変える副作用は、`changeSettings` に集める**: 変わった項目だけを見て、ショートカットの有効/無効・常に最前面・Web ミニアプリの音量・アイコンの取り直し・テーマカラー・背景画像を呼ぶ。
  デスクトップモードだけは、ウィンドウの操作なので、画面の更新・保存より先に頼む(切ったあと、すぐ操作できるように)。
- **ショートカットは、登録に成功してから保存する**(`changeHotkey`): ほかのアプリが使っていて登録できなければ、元のままにして知らせる。
- **プリセットを切り替えると、フォルダ・アイコンが入れ替わる**ので、開いているものと、元に戻す履歴を捨てる(`applyPresetMode`)。
  プリセットの選択は、設定の保存では変わらない(この関数でだけ変える)。
- **「デフォルト値にする」は、2 回押して実行する**(3 秒以内): 誤操作を防ぐため。フォルダや並び順などのデータは変えない。
- **色は、変数だけを渡す**: テーマ・UI の色・透過度・ぼかしは、`themeVarsOf` が作る変数で、CSS が使う(JS から色を直接書かない)。
- **設定画面の「Windows テーマ」の見本は、「好きな色」を選んでも Windows の色のまま**(`--sys-accent`)。

## 触るときの注意

- 文言は、日本語・英語の両方(`shared/i18n`)に足す。
- 設定の項目を足したら、`docs/manual-test.md` にも、確かめる項目を足すか考える(実機でしか確かめられないものがある)。
- `SettingsPanel.tsx` は大きい(約 270 行)。グループが増えたら、`〜Group.tsx` に分ける。
