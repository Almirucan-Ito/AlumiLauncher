//! ミニアプリ・ウィジェットのデータ・キャッシュの読み書き・大きさの取得・消去。

use crate::extensions::appdata;
use crate::extensions::catalog::miniapps_dir;
use crate::extensions::catalog::widgets_dir;
use crate::extensions::mini_web::web_in_use;
use crate::extensions::widgets;
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

/// ウィジェット・ミニアプリのフォルダを求める。
///
/// # 引数
/// * `app` - アプリのハンドル
/// * `kind` - `"widget"` か `"miniapp"`
/// * `id` - フォルダ名
///
/// # 戻り値
/// 実在するフォルダのパス。`kind` や `id` が不正、またはフォルダが無ければエラー
pub(crate) fn kind_dir(app: &AppHandle, kind: &str, id: &str) -> Result<PathBuf, String> {
    let root = match kind {
        "miniapp" => miniapps_dir(app),
        "widget" => widgets_dir(app),
        _ => None,
    }
    .ok_or_else(|| "invalid kind".to_string())?;
    appdata::app_dir(&root, id).ok_or_else(|| "not_found".to_string())
}

/// (コマンド)ウィジェット・ミニアプリのデータ(`data` フォルダの中身)を、すべて読む。
///
/// # 引数
/// * `kind` - `"widget"` か `"miniapp"`
/// * `id` - フォルダ名
///
/// # 戻り値
/// キー → 値の表
#[tauri::command]
pub async fn app_data_load(
    app: AppHandle,
    kind: String,
    id: String,
) -> Result<HashMap<String, String>, String> {
    let dir = kind_dir(&app, &kind, &id)?;
    tauri::async_runtime::spawn_blocking(move || appdata::load(&dir))
        .await
        .map_err(|e| e.to_string())
}

/// (コマンド)データを 1 つ保存する(`data\<キー>.txt`)。
///
/// # 引数
/// * `kind`, `id` - `app_data_load` と同じ
/// * `key`, `value` - 保存するキーと値(値は 64KB まで)
///
/// # 戻り値
/// `Ok(())` または失敗の理由
#[tauri::command]
pub async fn app_data_set(
    app: AppHandle,
    kind: String,
    id: String,
    key: String,
    value: String,
) -> Result<(), String> {
    let dir = kind_dir(&app, &kind, &id)?;
    tauri::async_runtime::spawn_blocking(move || appdata::set(&dir, &key, &value))
        .await
        .map_err(|e| e.to_string())?
}

/// (コマンド)キャッシュ(`cache\<キー>.txt`)を 1 つ読む。消えても困らない、作り直せるものだけを入れる。
///
/// # 引数
/// * `kind`, `id` - `app_data_load` と同じ
/// * `key` - キー名
///
/// # 戻り値
/// 値。無ければ `None`
#[tauri::command]
pub async fn app_cache_get(
    app: AppHandle,
    kind: String,
    id: String,
    key: String,
) -> Result<Option<String>, String> {
    let dir = kind_dir(&app, &kind, &id)?;
    Ok(appdata::cache_get(&dir, &key))
}

/// (コマンド)キャッシュを 1 つ保存する(`cache\<キー>.txt`)。
///
/// # 引数
/// * `kind`, `id` - `app_data_load` と同じ
/// * `key`, `value` - 保存するキーと値
///
/// # 戻り値
/// `Ok(())` または失敗の理由
#[tauri::command]
pub async fn app_cache_set(
    app: AppHandle,
    kind: String,
    id: String,
    key: String,
    value: String,
) -> Result<(), String> {
    let dir = kind_dir(&app, &kind, &id)?;
    tauri::async_runtime::spawn_blocking(move || appdata::cache_set(&dir, &key, &value))
        .await
        .map_err(|e| e.to_string())?
}

/// ウィジェット・ミニアプリ 1 つの、データとキャッシュの大きさ(バイト)。一覧の「データ・キャッシュを消す」画面に出す。
#[derive(Serialize)]
pub(crate) struct StorageInfo {
    pub(crate) kind: String,
    pub(crate) id: String,
    pub(crate) data: u64,
    pub(crate) cache: u64,
}

/// (コマンド)ウィジェット・ミニアプリごとの、データ・キャッシュの大きさを返す。
///
/// # 戻り値
/// 全部の一覧
#[tauri::command]
pub async fn app_storage_info(app: AppHandle) -> Vec<StorageInfo> {
    let roots = [
        ("widget", widgets_dir(&app)),
        ("miniapp", miniapps_dir(&app)),
    ];
    tauri::async_runtime::spawn_blocking(move || {
        let mut out = Vec::new();
        for (kind, root) in roots {
            let Some(root) = root else { continue };
            let Ok(rd) = fs::read_dir(&root) else {
                continue;
            };
            for e in rd.flatten() {
                let id = e.file_name().to_string_lossy().into_owned();
                if widgets::valid_id(&id) && e.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                    let u = appdata::usage(&e.path());
                    out.push(StorageInfo {
                        kind: kind.into(),
                        id,
                        data: u.data,
                        cache: u.cache,
                    });
                }
            }
        }
        out
    })
    .await
    .unwrap_or_default()
}

/// ウィジェット・ミニアプリ 1 つの、データかキャッシュを消す。
///
/// # 引数
/// * `kind`, `id` - 対象
/// * `what` - `"data"` か `"cache"`
///
/// # 戻り値
/// `Ok(())`、または `"in_use"`(開いている Web ミニアプリ)/ `"invalid"` / 失敗の理由
pub(crate) fn clear_one(app: &AppHandle, kind: &str, id: &str, what: &str) -> Result<(), String> {
    let dir = kind_dir(app, kind, id)?;
    if web_in_use(app, kind, id) {
        return Err("in_use".into());
    }
    match what {
        "data" => appdata::clear_data(&dir),
        "cache" => appdata::clear_cache(&dir),
        _ => Err("invalid".into()),
    }
}

/// (コマンド)ウィジェット・ミニアプリ 1 つの、データ(`"data"`)かキャッシュ(`"cache"`)を消す。
///
/// # 引数
/// * `kind`, `id`, `what` - `clear_one` と同じ
#[tauri::command]
pub async fn app_clear(
    app: AppHandle,
    kind: String,
    id: String,
    what: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || clear_one(&app, &kind, &id, &what))
        .await
        .map_err(|e| e.to_string())?
}

/// (コマンド)すべてのウィジェット・ミニアプリの、データかキャッシュを消す。開いている Web ミニアプリのものは、飛ばす。
///
/// # 引数
/// * `what` - `"data"` か `"cache"`
///
/// # 戻り値
/// 消せたものの数
#[tauri::command]
pub async fn app_clear_all(app: AppHandle, what: String) -> Result<usize, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut n = 0;
        for kind in ["widget", "miniapp"] {
            let root = if kind == "widget" {
                widgets_dir(&app)
            } else {
                miniapps_dir(&app)
            };
            let Some(root) = root else { continue };
            let Ok(rd) = fs::read_dir(&root) else {
                continue;
            };
            for e in rd.flatten() {
                let id = e.file_name().to_string_lossy().into_owned();
                if widgets::valid_id(&id)
                    && e.file_type().map(|t| t.is_dir()).unwrap_or(false)
                    && clear_one(&app, kind, &id, &what).is_ok()
                {
                    n += 1;
                }
            }
        }
        n
    })
    .await
    .map_err(|e| e.to_string())
}
