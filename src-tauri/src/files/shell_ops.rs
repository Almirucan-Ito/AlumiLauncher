//! エクスプローラー・プロパティ・「プログラムから開く」など、Windows のシェルの画面を出す操作。登録済みフォルダの中のものだけを扱う。

use crate::files::roots::in_registered;
use crate::platform::shortcut;
use std::path::Path;
use tauri::AppHandle;

/// (コマンド)「プログラムから開く」。アプリを選ぶ画面(エクスプローラーの右クリックの「プログラムから開く」と同じ)を出す。登録済みフォルダの中のファイルだけ。
///
/// # 引数
/// * `path` - 開くファイル
#[tauri::command]
pub async fn open_with(app: AppHandle, path: String) -> Result<(), String> {
    if !in_registered(&app, &path, false) || !Path::new(&path).is_file() {
        return Err("not_registered".into());
    }
    #[cfg(windows)]
    {
        shortcut::shell_verb(&path, "openas")
    }
    #[cfg(not(windows))]
    {
        Err("unsupported".into())
    }
}

/// (コマンド)プロパティの画面(エクスプローラーの右クリックの「プロパティ」と同じ)を出す。登録済みフォルダの中のファイル・フォルダだけ。
///
/// # 引数
/// * `path` - 対象のファイル・フォルダ
#[tauri::command]
pub async fn show_properties(app: AppHandle, path: String) -> Result<(), String> {
    if !in_registered(&app, &path, true) {
        return Err("not_registered".into());
    }
    #[cfg(windows)]
    {
        shortcut::shell_verb(&path, "properties")
    }
    #[cfg(not(windows))]
    {
        Err("unsupported".into())
    }
}

/// (コマンド)エクスプローラーで開く。
///
/// # 引数
/// * `path` - 開く対象(登録済みフォルダの中、またはそのフォルダ自身)
/// * `select` - `true` なら、そのファイルを選択した状態で、フォルダを開く
#[tauri::command]
pub async fn reveal(app: AppHandle, path: String, select: bool) -> Result<(), String> {
    if !in_registered(&app, &path, true) {
        return Err("not_registered".into());
    }
    let mut cmd = std::process::Command::new("explorer.exe");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        if select {
            cmd.raw_arg(format!("/select,\"{path}\""));
        } else {
            cmd.arg(&path);
        }
    }
    #[cfg(not(windows))]
    cmd.arg(&path);
    let _ = select;
    cmd.spawn().map(|_| ()).map_err(|e| e.to_string())
}
