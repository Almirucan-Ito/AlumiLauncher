//! ミニアプリが使う音楽・画像ファイルの登録(再生・表示用の印を渡す)。

use crate::extensions::music;
use crate::state::AppState;
use crate::state::LockExt;
use std::path::Path;
use tauri::AppHandle;
use tauri::Manager;

/// (コマンド)音声ファイルを登録して、再生用の印(token)を受け取る(音声でないもの・無いものは除く)。
///
/// # 引数
/// * `paths` - 音声ファイルのパス(`MAX_TRACKS` 個まで)
///
/// # 戻り値
/// 登録できた曲の情報
#[tauri::command]
pub async fn music_register(app: AppHandle, paths: Vec<String>) -> Vec<music::Track> {
    let state = app.state::<AppState>();
    let mut reg = state.music.lock_ok();
    paths
        .iter()
        .take(music::MAX_TRACKS)
        .filter_map(|p| reg.register(Path::new(p)))
        .collect()
}

/// (コマンド)フォルダの中の音声ファイルを(サブフォルダも)探して登録する。
///
/// # 引数
/// * `dir` - 探すフォルダ
///
/// # 戻り値
/// 登録できた曲の情報
#[tauri::command]
pub async fn music_scan_folder(app: AppHandle, dir: String) -> Vec<music::Track> {
    let found = tauri::async_runtime::spawn_blocking(move || {
        let mut out = Vec::new();
        music::scan_dir(Path::new(&dir), 0, &mut out);
        out
    })
    .await
    .unwrap_or_default();
    let state = app.state::<AppState>();
    let mut reg = state.music.lock_ok();
    found.iter().filter_map(|p| reg.register(p)).collect()
}

/// (コマンド)画像を登録して、表示用の印(token)を受け取る(画像でないもの・無いものは除く)。
///
/// # 引数
/// * `paths` - 画像ファイルのパス(`MAX_TRACKS` 個まで)
///
/// # 戻り値
/// 登録できた画像の情報
#[tauri::command]
pub async fn image_register(app: AppHandle, paths: Vec<String>) -> Vec<music::Track> {
    let state = app.state::<AppState>();
    let mut reg = state.music.lock_ok();
    paths
        .iter()
        .take(music::MAX_TRACKS)
        .filter_map(|p| reg.register_image(Path::new(p)))
        .collect()
}

/// (コマンド)フォルダの中の画像を(サブフォルダも)探して登録する。
///
/// # 引数
/// * `dir` - 探すフォルダ
///
/// # 戻り値
/// 登録できた画像の情報
#[tauri::command]
pub async fn image_scan_folder(app: AppHandle, dir: String) -> Vec<music::Track> {
    let found = tauri::async_runtime::spawn_blocking(move || {
        let mut out = Vec::new();
        music::scan_images(Path::new(&dir), 0, &mut out);
        out
    })
    .await
    .unwrap_or_default();
    let state = app.state::<AppState>();
    let mut reg = state.music.lock_ok();
    found.iter().filter_map(|p| reg.register_image(p)).collect()
}
