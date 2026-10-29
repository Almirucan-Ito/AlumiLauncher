//! 背景画像の取り込み・読み込みと、Windows のテーマカラー。

use crate::config::store::data_dir;
use crate::platform::shortcut;
use std::fs;
use std::path::Path;
use std::path::PathBuf;
use tauri::AppHandle;

/// (コマンド)Windows のテーマカラー(アクセントカラー)を返す。
///
/// # 戻り値
/// `"#rrggbb"`。取得できなければ `None`
#[tauri::command]
pub async fn get_accent_color() -> Option<String> {
    #[cfg(windows)]
    {
        shortcut::accent_color()
    }
    #[cfg(not(windows))]
    {
        None
    }
}

/// 背景画像として使える拡張子か判定し、MIME タイプを返す。
///
/// # 引数
/// * `ext` - 小文字の拡張子(`.` なし)
///
/// # 戻り値
/// 対応していれば MIME タイプ。そうでなければ `None`
pub(crate) fn image_mime(ext: &str) -> Option<&'static str> {
    match ext {
        "png" => Some("image/png"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "webp" => Some("image/webp"),
        "gif" => Some("image/gif"),
        "bmp" => Some("image/bmp"),
        _ => None,
    }
}

/// データフォルダの中から、背景画像(`background.<拡張子>`)を探す。
///
/// # 引数
/// * `dir` - データフォルダ
///
/// # 戻り値
/// 見つかったファイルのパス。無ければ `None`
pub(crate) fn find_background(dir: &Path) -> Option<PathBuf> {
    fs::read_dir(dir)
        .ok()?
        .flatten()
        .map(|e| e.path())
        .find(|p| {
            p.file_stem().map(|s| s == "background").unwrap_or(false)
                && p.extension()
                    .map(|e| image_mime(&e.to_string_lossy().to_lowercase()).is_some())
                    .unwrap_or(false)
        })
}

/// (コマンド)選んだ画像を、データフォルダに `background.<拡張子>` としてコピーし(古い背景は消す)、表示用に画像のバイト列を返す。
/// 文字列(Base64)にしないので、画面側のメモリが小さくて済む。
///
/// # 引数
/// * `src` - 選んだ画像のパス(png / jpg / webp / gif / bmp、20MB まで)
///
/// # 戻り値
/// 画像のバイト列。対応していない形式・大きすぎる・読めないときはエラー(`"unsupported"` / `"too_large"`)
#[tauri::command]
pub async fn import_background(
    app: AppHandle,
    src: String,
) -> Result<tauri::ipc::Response, String> {
    let src = PathBuf::from(src);
    let ext = src
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    image_mime(&ext).ok_or_else(|| "unsupported".to_string())?;
    let meta = fs::metadata(&src).map_err(|e| e.to_string())?;
    if meta.len() > 20 * 1024 * 1024 {
        return Err("too_large".into());
    }
    let bytes = fs::read(&src).map_err(|e| e.to_string())?;
    let dir = data_dir(&app).map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    while let Some(old) = find_background(&dir) {
        fs::remove_file(old).map_err(|e| e.to_string())?;
    }
    fs::write(dir.join(format!("background.{ext}")), &bytes).map_err(|e| e.to_string())?;
    Ok(tauri::ipc::Response::new(bytes))
}

/// (コマンド)背景画像のバイト列を返す。
///
/// # 戻り値
/// 画像のバイト列。まだ設定していなければエラー(`"none"`)
#[tauri::command]
pub async fn load_background(app: AppHandle) -> Result<tauri::ipc::Response, String> {
    let dir = data_dir(&app).map_err(|e| e.to_string())?;
    let path = find_background(&dir).ok_or_else(|| "none".to_string())?;
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    Ok(tauri::ipc::Response::new(bytes))
}
