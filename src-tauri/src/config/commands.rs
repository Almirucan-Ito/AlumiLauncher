//! (コマンド)設定の読み込み・保存・プリセット切り替え・フォルダの確認。画面から呼ばれる。

use crate::config::model::store_view;
use crate::config::model::view_of;
use crate::config::model::Config;
use crate::config::sanitize::sanitize_config;
use crate::config::store::read_config;
use crate::config::store::schedule_flush;
use crate::files::roots::is_allowed_folder;
use crate::files::roots::refresh_roots;
use crate::state::AppState;
use crate::state::LockExt;
use tauri::AppHandle;
use tauri::Manager;

/// (コマンド)画面へ渡す設定を返す。いま表示するプリセットのフォルダ・並び順と、設定。
///
/// # 戻り値
/// 画面用の設定
#[tauri::command]
pub async fn load_config(app: AppHandle) -> Result<Config, String> {
    Ok(view_of(&read_config(&app)))
}

/// (コマンド)フォルダを一覧に登録してよいか。画面側が登録の前に確認する。
///
/// # 引数
/// * `path` - フォルダのパス
///
/// # 戻り値
/// 登録してよければ `true`
#[tauri::command]
pub async fn validate_folder(path: String) -> bool {
    is_allowed_folder(&path)
}

/// (コマンド)画面から届いた設定を検査して保存する。ディスクへの書き込みは、少し待って(`schedule_flush`)まとめて行う。
/// 画面が持っているのは表示中のプリセットだけなので、プリセットの選択そのもの(`preset` など)は、ここでは変えない(`set_preset_mode` で変える)。
/// 登録フォルダが変わったときだけ、操作してよいフォルダの一覧と見張りを作り直す。
///
/// # 引数
/// * `config` - 画面から届いた設定
///
/// # 戻り値
/// `Ok(())`
#[tauri::command]
pub async fn save_config(app: AppHandle, mut config: Config) -> Result<(), String> {
    sanitize_config(&mut config);
    let folders_changed;
    {
        // 画面が持っているのは、いま表示中のプリセットだけ。プリセットの選択そのものは set_preset_mode でだけ変える
        let state = app.state::<AppState>();
        let mut full = state.config.lock_ok();
        config.settings.preset = full.settings.preset;
        config.settings.presets_enabled = full.settings.presets_enabled;
        config.settings.preset_count = full.settings.preset_count;
        // スタートアップの選択も、画面の古い値で上書きしない(set_autostart でだけ変える)
        config.settings.autostart = full.settings.autostart;
        full.settings = config.settings.clone();
        // 見張るフォルダが変わらない保存(ウィジェットのデータ・設定の変更など)では、見張りを作り直さない
        let before: Vec<String> = view_of(&full).folders.into_iter().map(|f| f.path).collect();
        store_view(&mut full, config);
        sanitize_config(&mut full);
        folders_changed = before
            != view_of(&full)
                .folders
                .into_iter()
                .map(|f| f.path)
                .collect::<Vec<_>>();
    }
    if folders_changed {
        refresh_roots(&app);
    }
    schedule_flush(&app);
    Ok(())
}

/// (コマンド)プリセットを使うか・どれを表示するかを変える。
///
/// # 引数
/// * `enabled` - プリセットを使うか
/// * `preset` - 表示するプリセット(1〜プリセット数に収める)
/// * `count` - プリセットの数(1〜9)
///
/// # 戻り値
/// 変更後に画面へ出す設定(そのプリセットのフォルダ・並び順)
#[tauri::command]
pub async fn set_preset_mode(
    app: AppHandle,
    enabled: bool,
    preset: u32,
    count: u32,
) -> Result<Config, String> {
    let view = {
        let state = app.state::<AppState>();
        let mut full = state.config.lock_ok();
        full.settings.presets_enabled = enabled;
        full.settings.preset_count = count.clamp(1, 9);
        full.settings.preset = preset.clamp(1, full.settings.preset_count);
        view_of(&full)
    };
    refresh_roots(&app);
    schedule_flush(&app);
    Ok(view)
}
