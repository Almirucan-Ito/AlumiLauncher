//! ウィジェット・ミニアプリの一覧・取り込み・フォルダを開く・ホームのショートカット作成。

use crate::config::store::data_dir;
use crate::extensions::widgets;
use crate::files::listing::get_launcher_folder;
use crate::files::operations::unique_path;
use crate::files::roots::in_registered;
use crate::files::text_files::text_file_name;
use serde::Serialize;
use std::fs;
use std::path::Path;
use std::path::PathBuf;
use tauri::AppHandle;

/// 追加ウィジェット(Mod)を置くフォルダ(`<データ>\widgets`)を返す。
///
/// # 戻り値
/// フォルダのパス(データフォルダが分からなければ `None`)
pub(crate) fn widgets_dir(app: &AppHandle) -> Option<PathBuf> {
    data_dir(app).ok().map(|d| d.join("widgets"))
}

/// ミニアプリを置くフォルダ(`<データ>\miniapps`)を返す。
///
/// # 戻り値
/// フォルダのパス(データフォルダが分からなければ `None`)
pub(crate) fn miniapps_dir(app: &AppHandle) -> Option<PathBuf> {
    data_dir(app).ok().map(|d| d.join("miniapps"))
}

/// (コマンド)ウィジェットの一覧(widgets フォルダのものと、ミニアプリの中のもの)を返す。
#[tauri::command]
pub async fn list_widgets(app: AppHandle) -> Vec<widgets::WidgetInfo> {
    let (Some(w), Some(m)) = (widgets_dir(&app), miniapps_dir(&app)) else {
        return Vec::new();
    };
    tauri::async_runtime::spawn_blocking(move || widgets::scan(&w, &m))
        .await
        .unwrap_or_default()
}

/// (コマンド)ミニアプリの一覧を返す。
#[tauri::command]
pub async fn list_miniapps(app: AppHandle) -> Vec<widgets::MiniAppInfo> {
    let Some(m) = miniapps_dir(&app) else {
        return Vec::new();
    };
    tauri::async_runtime::spawn_blocking(move || widgets::scan_miniapps(&m))
        .await
        .unwrap_or_default()
}

/// (コマンド)ウィジェットを置くフォルダ(widgets)を、エクスプローラーで開く(無ければ作る)。
#[tauri::command]
pub async fn open_widgets_root(app: AppHandle) -> Result<(), String> {
    let dir = widgets_dir(&app).ok_or_else(|| "no app data dir".to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    std::process::Command::new("explorer.exe")
        .arg(&dir)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// (コマンド)ミニアプリを置くフォルダ(miniapps)を、エクスプローラーで開く(無ければ作る)。
#[tauri::command]
pub async fn open_miniapps_root(app: AppHandle) -> Result<(), String> {
    let dir = miniapps_dir(&app).ok_or_else(|| "no app data dir".to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    std::process::Command::new("explorer.exe")
        .arg(&dir)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// (コマンド)ミニアプリの中の widgets フォルダ(そのミニアプリのウィジェットを置く場所)を、エクスプローラーで開く(無ければ作る)。
///
/// # 引数
/// * `id` - ミニアプリのフォルダ名
#[tauri::command]
pub async fn open_miniapp_widgets_dir(app: AppHandle, id: String) -> Result<(), String> {
    if !widgets::valid_id(&id) {
        return Err("invalid id".into());
    }
    let app_dir = miniapps_dir(&app)
        .ok_or_else(|| "no app data dir".to_string())?
        .join(&id);
    if !app_dir.is_dir() {
        return Err("not_found".into());
    }
    let dir = app_dir.join("widgets");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    std::process::Command::new("explorer.exe")
        .arg(&dir)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// (コマンド)ミニアプリ 1 つのフォルダを、エクスプローラーで開く。
///
/// # 引数
/// * `id` - ミニアプリのフォルダ名
#[tauri::command]
pub async fn open_miniapp_dir(app: AppHandle, id: String) -> Result<(), String> {
    if !widgets::valid_id(&id) {
        return Err("invalid id".into());
    }
    let dir = miniapps_dir(&app)
        .ok_or_else(|| "no app data dir".to_string())?
        .join(&id);
    if !dir.is_dir() {
        return Err("not_found".into());
    }
    std::process::Command::new("explorer.exe")
        .arg(&dir)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// (コマンド)ホームに、ミニアプリのアイコン(`.alumiapp`)を作る。中身は、ミニアプリのフォルダ名だけ。
///
/// # 引数
/// * `id` - ミニアプリのフォルダ名(存在するもの)
///
/// # 戻り値
/// 作ったファイルのパス
#[tauri::command]
pub async fn create_miniapp_shortcut(app: AppHandle, id: String) -> Result<String, String> {
    let info = {
        let m = miniapps_dir(&app).ok_or_else(|| "no app data dir".to_string())?;
        widgets::scan_miniapps(&m)
            .into_iter()
            .find(|a| a.id == id)
            .ok_or_else(|| "not_found".to_string())?
    };
    let dir = get_launcher_folder(app).await?;
    let stem = text_file_name(&info.name, &info.id);
    let stem = stem.strip_suffix(".txt").unwrap_or(&stem).to_string();
    let path = unique_path(Path::new(&dir).join(format!("{stem}.alumiapp")));
    fs::write(&path, serde_json::json!({ "miniapp": info.id }).to_string())
        .map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

/// `.alumiapp` ファイルが指すミニアプリのフォルダ名を読む。
///
/// # 引数
/// * `path` - `.alumiapp` ファイルのパス(4KB まで)
///
/// # 戻り値
/// フォルダ名。拡張子が違う・壊れている・名前が不正なら `None`
pub(crate) fn miniapp_id_of_file(path: &str) -> Option<String> {
    if !path.to_lowercase().ends_with(".alumiapp") || fs::metadata(path).ok()?.len() > 4096 {
        return None;
    }
    let v: serde_json::Value = serde_json::from_str(&fs::read_to_string(path).ok()?).ok()?;
    let id = v.get("miniapp")?.as_str()?.to_string();
    widgets::valid_id(&id).then_some(id)
}

/// (コマンド)ホームの `.alumiapp` のアイコンをクリックしたとき、どのミニアプリを開くかを返す(存在するものだけ)。
///
/// # 引数
/// * `path` - `.alumiapp` ファイルのパス(登録済みフォルダの中)
///
/// # 戻り値
/// ミニアプリのフォルダ名。見つからなければエラー(`"not_found"`)
#[tauri::command]
pub async fn miniapp_of_file(app: AppHandle, path: String) -> Result<String, String> {
    if !in_registered(&app, &path, false) {
        return Err("not_registered".into());
    }
    let id = miniapp_id_of_file(&path).ok_or_else(|| "not_found".to_string())?;
    let root = miniapps_dir(&app).ok_or_else(|| "no app data dir".to_string())?;
    widgets::scan_miniapps(&root)
        .into_iter()
        .any(|a| a.id == id)
        .then_some(id)
        .ok_or_else(|| "not_found".to_string())
}

/// 取り込み(インストール)の結果。`installed` は取り込めたもの、`rest` はウィジェット・ミニアプリではなかったもの(通常のフォルダ追加へ回す)。
#[derive(Serialize)]
pub(crate) struct InstallResult {
    pub(crate) installed: Vec<widgets::Installed>,
    /// ウィジェット・ミニアプリではなかったもの(通常のフォルダ追加などに回す)
    pub(crate) rest: Vec<String>,
}

/// (コマンド)ドロップされたフォルダのうち、ウィジェット・ミニアプリのものを取り込む(widgets / miniapps フォルダへコピー)。
///
/// # 引数
/// * `paths` - ドロップされたフォルダのパス
///
/// # 戻り値
/// 取り込めたものと、そうでなかったものの一覧。1 つも取り込めず、失敗があったときはエラー
#[tauri::command]
pub async fn install_extensions(
    app: AppHandle,
    paths: Vec<String>,
) -> Result<InstallResult, String> {
    let (Some(w), Some(m)) = (widgets_dir(&app), miniapps_dir(&app)) else {
        return Err("no app data dir".into());
    };
    tauri::async_runtime::spawn_blocking(move || {
        let mut res = InstallResult {
            installed: Vec::new(),
            rest: Vec::new(),
        };
        let mut first_err = None;
        for p in paths {
            match widgets::install_dir(Path::new(&p), &w, &m) {
                Ok(Some(i)) => res.installed.push(i),
                Ok(None) => res.rest.push(p),
                Err(e) => first_err = first_err.or(Some(e)),
            }
        }
        match (res.installed.is_empty(), first_err) {
            (true, Some(e)) => Err(e),
            _ => Ok(res),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

/// (コマンド)追加ウィジェット 1 つのフォルダを、エクスプローラーで開く。
///
/// # 引数
/// * `id` - ウィジェットのフォルダ名
#[tauri::command]
pub async fn open_widget_dir(app: AppHandle, id: String) -> Result<(), String> {
    if !widgets::valid_id(&id) {
        return Err("invalid id".into());
    }
    let dir = widgets_dir(&app)
        .ok_or_else(|| "no app data dir".to_string())?
        .join(&id);
    if !dir.is_dir() {
        return Err("not_found".into());
    }
    std::process::Command::new("explorer.exe")
        .arg(&dir)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}
