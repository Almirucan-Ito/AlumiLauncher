//! Windows のシェルを使う機能のコマンド(ファイルのドラッグ・スタートメニューのアプリ)。

use crate::files::listing::get_launcher_folder;
use crate::files::operations::LauncherAdd;
use crate::files::roots::in_registered;
use crate::logging;
use crate::platform::dragout;
use crate::platform::startmenu;
use std::path::Path;
use std::path::PathBuf;
use tauri::AppHandle;

/// (コマンド)画面で起きた失敗を、記録(ログ)に書く。
///
/// # 引数
/// * `level` - `error` か `warn`(それ以外は `info`)
/// * `message` - 内容
#[tauri::command]
pub async fn write_log(level: String, message: String) {
    let level = match level.as_str() {
        "error" => "ERROR",
        "warn" => "WARN",
        _ => "INFO",
    };
    logging::write(level, &format!("[画面] {message}"));
}

/// (コマンド)スタートメニューのアプリ(通常のアプリ・ストアアプリ)の一覧を返す。「スタートメニューから追加」の画面に使う。
///
/// # 戻り値
/// 名前順の一覧。読めなければ理由
#[tauri::command]
pub async fn list_start_apps() -> Result<Vec<startmenu::StartApp>, String> {
    tauri::async_runtime::spawn_blocking(startmenu::list)
        .await
        .map_err(|e| e.to_string())?
}

/// (コマンド)スタートメニューのアプリを、ショートカットとして、ホーム(launcherFolder)に複製する。元のアプリ・スタートメニューには何もしない。
///
/// # 引数
/// * `id` - `list_start_apps` が返した ID
///
/// # 戻り値
/// 追加できた数(1)と、追加先のパス
#[tauri::command]
pub async fn add_start_app(app: AppHandle, id: String) -> Result<LauncherAdd, String> {
    let path = get_launcher_folder(app).await?;
    let dir = PathBuf::from(&path);
    tauri::async_runtime::spawn_blocking(move || startmenu::create_shortcut(&id, &dir))
        .await
        .map_err(|e| e.to_string())??;
    Ok(LauncherAdd { added: 1, path })
}

/// (コマンド)アプリのアイコン(ファイル)を、デスクトップやエクスプローラーのフォルダへドラッグして移動する。マウスの左ボタンを押している間、OS 標準のドラッグを行い、離した先が受け取れば移動される。
/// ドラッグはウィンドウを持つメインスレッドで行い、終わるまで待つ。
///
/// # 引数
/// * `path` - ドラッグするファイル(登録済みフォルダの中)
///
/// # 戻り値
/// 移動されたら `true`
#[tauri::command]
pub async fn start_file_drag(app: AppHandle, path: String) -> Result<bool, String> {
    // 登録済みフォルダ内のファイルだけ(任意のファイルを画面側から動かされないように)
    if !in_registered(&app, &path, false) {
        return Err("not_registered".into());
    }
    if !Path::new(&path).is_file() {
        return Err("not a file".into());
    }
    #[cfg(windows)]
    {
        // ドラッグは、ウィンドウを持つメインのスレッドで行う(終わるまで、そのスレッドの中で待つ)
        let (tx, rx) = std::sync::mpsc::channel();
        app.run_on_main_thread(move || {
            let _ = tx.send(dragout::drag_file_out(&path));
        })
        .map_err(|e| e.to_string())?;
        tauri::async_runtime::spawn_blocking(move || rx.recv().map_err(|e| e.to_string()))
            .await
            .map_err(|e| e.to_string())??
    }
    #[cfg(not(windows))]
    {
        Err("unsupported".into())
    }
}
