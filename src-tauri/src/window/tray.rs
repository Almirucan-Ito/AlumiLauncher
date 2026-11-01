//! タスクトレイのメニューの項目と、スタートアップ(自動起動)の登録。

use crate::config::store::schedule_flush;
use crate::platform::locale::is_ja;
use crate::state::{AppState, LockExt};
use tauri::{AppHandle, Manager};

/// トレイメニューの「Windows 起動時に自動で起動」のチェック項目(設定画面の切り替えと同期するため保持)。
pub(crate) struct TrayAutostart(pub(crate) tauri::menu::CheckMenuItem<tauri::Wry>);

/// 「スタートアップをオンにしている」という選択を、設定ファイルに覚える(アプリを入れ直して登録が消えても、起動時に登録し直せるように)。
///
/// # 引数
/// * `app` - アプリのハンドル
/// * `enabled` - オンにしているか
pub(crate) fn remember_autostart(app: &AppHandle, enabled: bool) {
    app.state::<AppState>().config.lock_ok().settings.autostart = enabled;
    schedule_flush(app);
}

/// (コマンド)スタートアップ(Windows 起動時の自動起動)が登録されているか。
#[tauri::command]
pub async fn get_autostart(app: AppHandle) -> bool {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch().is_enabled().unwrap_or(false)
}

/// (コマンド)スタートアップ(Windows 起動時の自動起動)の登録/解除。トレイのチェックも合わせる。
///
/// # 引数
/// * `enabled` - 登録するか
///
/// # 戻り値
/// 変更後の状態(登録されていれば `true`)
#[tauri::command]
pub async fn set_autostart(app: AppHandle, enabled: bool) -> bool {
    use tauri_plugin_autostart::ManagerExt;
    let al = app.autolaunch();
    let _ = if enabled { al.enable() } else { al.disable() };
    let now = al.is_enabled().unwrap_or(false);
    remember_autostart(&app, now);
    if let Some(item) = app.try_state::<TrayAutostart>() {
        let _ = item.0.set_checked(now);
    }
    now
}

/// トレイメニューの「表示」項目の文言を作る(例: `表示 (Ctrl+Alt+L)`)。
///
/// # 引数
/// * `combo` - ショートカットの組み合わせ
pub(crate) fn show_label(combo: &str) -> String {
    format!("{} ({combo})", if is_ja() { "表示" } else { "Show" })
}

/// トレイメニューの「表示」項目(ショートカットを変えたときに、表示中の組み合わせも合わせる)。
pub(crate) struct TrayShow(pub(crate) tauri::menu::MenuItem<tauri::Wry>);
