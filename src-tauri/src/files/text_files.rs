//! テキストファイル(.txt / .md)の作成・読み書き。登録済みフォルダの中のものだけを扱う。

use crate::files::listing::get_launcher_folder;
use crate::files::operations::unique_path;
use crate::files::roots::in_registered;
use std::fs;
use std::path::Path;
use tauri::AppHandle;

/// テキストファイルのファイル名を作る。使えない文字は除き、80 字までにして、拡張子が txt / md でなければ `.txt` を付ける。`CON` / `NUL` などの予約名は、先頭に `_` を付ける。
///
/// # 引数
/// * `name` - 付けたい名前(空なら `fallback`)
/// * `fallback` - 名前が空のときの名前
///
/// # 戻り値
/// ファイル名
pub(crate) fn text_file_name(name: &str, fallback: &str) -> String {
    let cleaned: String = name
        .chars()
        .filter(|c| !c.is_control() && !"\\/:*?\"<>|".contains(*c))
        .collect();
    let cleaned = cleaned
        .trim()
        .trim_matches('.')
        .trim()
        .chars()
        .take(80)
        .collect::<String>();
    let mut base = if cleaned.is_empty() {
        fallback.trim().to_string()
    } else {
        cleaned
    };
    let lower = base.to_lowercase();
    if !(lower.ends_with(".txt") || lower.ends_with(".md")) {
        base.push_str(".txt");
    }
    // CON / NUL などの予約名は Windows で作れない
    let stem = base
        .rsplit_once('.')
        .map(|(s, _)| s)
        .unwrap_or(&base)
        .to_uppercase();
    let reserved = ["CON", "PRN", "AUX", "NUL"].contains(&stem.as_str())
        || ((stem.starts_with("COM") || stem.starts_with("LPT"))
            && stem.len() == 4
            && stem.as_bytes()[3].is_ascii_digit());
    if reserved {
        base.insert(0, '_');
    }
    base
}

/// (コマンド)ホーム(launcherFolder)に、テキストファイルを新しく作る(同名があれば連番)。右クリックの「新規ファイルの作成」と、メモの保存に使う。
///
/// # 引数
/// * `name` - ファイル名(拡張子が無ければ `.txt`)
/// * `content` - 中身(4MB まで)
/// * `fallback` - `name` が空のときのファイル名
///
/// # 戻り値
/// 作ったファイルのパス
#[tauri::command]
pub async fn create_text_file(
    app: AppHandle,
    name: String,
    content: String,
    fallback: String,
) -> Result<String, String> {
    if content.len() > 4 * 1024 * 1024 {
        return Err("too large".into());
    }
    let dir = get_launcher_folder(app).await?;
    let path = unique_path(Path::new(&dir).join(text_file_name(&name, &fallback)));
    fs::write(&path, content.as_bytes()).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

/// (コマンド)ホームのテキストファイル(.txt / .md)を読む(登録済みフォルダの中だけ。2MB まで)。
///
/// # 引数
/// * `path` - ファイルのパス
///
/// # 戻り値
/// ファイルの中身。条件に合わなければエラーの理由
#[tauri::command]
pub async fn read_text_file(app: AppHandle, path: String) -> Result<String, String> {
    check_text_path(&app, &path)?;
    if fs::metadata(&path).map_err(|e| e.to_string())?.len() > 2 * 1024 * 1024 {
        return Err("too large".into());
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

/// (コマンド)ホームのテキストファイル(.txt / .md)を上書きする(すでにあるものだけ。登録済みフォルダの中だけ。2MB まで)。
///
/// # 引数
/// * `path` - ファイルのパス
/// * `content` - 新しい中身
///
/// # 戻り値
/// `Ok(())` または失敗の理由
#[tauri::command]
pub async fn write_text_file(app: AppHandle, path: String, content: String) -> Result<(), String> {
    check_text_path(&app, &path)?;
    if content.len() > 2 * 1024 * 1024 {
        return Err("too large".into());
    }
    fs::write(&path, content.as_bytes()).map_err(|e| e.to_string())
}

/// テキストファイルとして読み書きしてよいパスか調べる(拡張子が txt / md で、実在し、登録済みフォルダの中にあること)。
///
/// # 引数
/// * `app` - アプリのハンドル
/// * `path` - 調べるパス
///
/// # 戻り値
/// `Ok(())`、または `"not a text file"` / `"not_registered"`
pub(crate) fn check_text_path(app: &AppHandle, path: &str) -> Result<(), String> {
    let lower = path.to_lowercase();
    if !(lower.ends_with(".txt") || lower.ends_with(".md")) || !Path::new(path).is_file() {
        return Err("not a text file".into());
    }
    if !in_registered(app, path, false) {
        return Err("not_registered".into());
    }
    Ok(())
}
