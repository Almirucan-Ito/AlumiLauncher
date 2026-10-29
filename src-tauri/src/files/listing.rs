//! ホームとフォルダの中身の一覧(アイコンの並び・隠しファイルの除外・アイコン画像)と、launcherFolder の場所。

use crate::config::model::active_preset;
use crate::config::store::data_dir;
use crate::extensions::catalog::miniapp_id_of_file;
use crate::extensions::catalog::miniapps_dir;
use crate::extensions::widgets;
use crate::files::roots::in_registered;
use crate::files::roots::refresh_roots;
use crate::platform::icon;
use crate::state::AppState;
use crate::state::LockExt;
use base64::Engine;
use serde::Serialize;
use std::collections::HashSet;
use std::fs;
use std::path::Path;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

/// 1フォルダあたりに読み込むアイコン数の上限(巨大なフォルダを登録されても固まらないように)
pub(crate) const MAX_ITEMS: usize = 3000;

/// フォルダの中の 1 つのアイコン(ファイル)。画面へ返す。`name` は、拡張子を含むファイル名。
#[derive(Serialize)]
pub(crate) struct Item {
    pub(crate) name: String,
    pub(crate) path: String,
}

/// ホームにドロップされたショートカット・ファイルの保存先(データ保持用フォルダの下)
pub(crate) const LAUNCHER_DIR: &str = "launcherFolder";

/// ホーム画面の並び順(フォルダと、ホームに直接置いたアイコンの混在順)を `orders` に保存するときのキー
pub(crate) const HOME_ORDER_KEY: &str = "__home__";

/// プリセットごとの、ホームのアイコンの保存先を求める(プリセット 1 は launcherFolder、2〜9 は launcherFolder2〜launcherFolder9)。
///
/// # 引数
/// * `app` - アプリのハンドル
/// * `preset` - プリセット番号
///
/// # 戻り値
/// フォルダのパス
pub(crate) fn launcher_dir_for(app: &AppHandle, preset: u32) -> Option<PathBuf> {
    let name = if preset <= 1 {
        LAUNCHER_DIR.to_string()
    } else {
        format!("{LAUNCHER_DIR}{preset}")
    };
    data_dir(app).ok().map(|d| d.join(name))
}

/// いま表示しているプリセットの、ホームのアイコンの保存先を返す。
///
/// # 戻り値
/// フォルダのパス(データフォルダが分からなければ `None`)
pub(crate) fn launcher_dir(app: &AppHandle) -> Option<PathBuf> {
    let n = active_preset(&app.state::<AppState>().config.lock_ok().settings);
    launcher_dir_for(app, n)
}

/// (コマンド)ホームに直接並べるショートカットの保存先フォルダ(無ければ作る)のパスを返す。
///
/// # 戻り値
/// フォルダのパス
#[tauri::command]
pub async fn get_launcher_folder(app: AppHandle) -> Result<String, String> {
    let dir = launcher_dir(&app).ok_or_else(|| "no app data dir".to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    refresh_roots(&app);
    Ok(dir.to_string_lossy().into_owned())
}

/// 隠しファイル(Windows の隠し属性、または名前が `.` で始まるもの)か。
///
/// # 引数
/// * `entry` - ディレクトリの項目
/// * `name` - ファイル名
///
/// # 戻り値
/// 隠しファイルなら `true`
#[cfg(windows)]
pub(crate) fn is_hidden(entry: &fs::DirEntry, name: &str) -> bool {
    use std::os::windows::fs::MetadataExt;
    name.starts_with('.')
        || entry
            .metadata()
            .map(|m| m.file_attributes() & 0x2 != 0)
            .unwrap_or(false) // FILE_ATTRIBUTE_HIDDEN
}

#[cfg(not(windows))]
pub(crate) fn is_hidden(_entry: &fs::DirEntry, name: &str) -> bool {
    name.starts_with('.')
}

/// フォルダの中のファイルを集めて、アイコンの一覧にする。スタートメニューのようにサブフォルダがある場合は、中身を平らに並べる(深さ 3 まで。ジャンクション等は辿らない)。
/// 隠しファイルと `.ini` / `.db` / `.tmp` は除く。同じ名前(大文字・小文字を区別しない)は、最初の 1 つだけ。
///
/// # 引数
/// * `dir` - 集めるフォルダ
/// * `depth` - いまの深さ(最初は 0)
/// * `out` - 集めたものを足す先(`MAX_ITEMS` 個まで)
/// * `seen` - すでに採用した名前(重複を除くため)
pub(crate) fn collect(dir: &Path, depth: u32, out: &mut Vec<Item>, seen: &mut HashSet<String>) {
    let Ok(rd) = fs::read_dir(dir) else { return };
    for entry in rd.flatten() {
        if out.len() >= MAX_ITEMS {
            return;
        }
        let path = entry.path();
        let file_name = entry.file_name().to_string_lossy().into_owned();
        if is_hidden(&entry, &file_name) {
            continue;
        }
        let Ok(kind) = entry.file_type() else {
            continue;
        };
        if kind.is_dir() {
            // スタートメニューのようにサブフォルダがある場合は中身を平らに並べる(ジャンクション等は辿らない)
            if depth < 3 {
                collect(&path, depth + 1, out, seen);
            }
            continue;
        }
        let ext = path
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        if matches!(ext.as_str(), "ini" | "db" | "tmp") {
            continue;
        }
        // 拡張子も表示する(Google Chrome.lnk など)
        let name = file_name;
        if seen.insert(name.to_lowercase()) {
            out.push(Item {
                name,
                path: path.to_string_lossy().into_owned(),
            });
        }
    }
}

/// (コマンド)フォルダの中のアイコンの一覧を返す(名前の小文字順)。ディスクの読み取りは、別のスレッドで行う。
///
/// # 引数
/// * `path` - 登録済みフォルダ(またはホームの保存先)
///
/// # 戻り値
/// アイコンの一覧。登録外・フォルダが無いときはエラー
#[tauri::command]
pub async fn list_items(app: AppHandle, path: String) -> Result<Vec<Item>, String> {
    if !in_registered(&app, &path, true) {
        return Err("not_registered".into());
    }
    // ディスクI/Oを非同期ランタイムのスレッドで直接行わない
    tauri::async_runtime::spawn_blocking(move || {
        let dir = PathBuf::from(&path);
        if !dir.is_dir() {
            return Err("not_found".to_string());
        }
        let mut items = Vec::new();
        collect(&dir, 0, &mut items, &mut HashSet::new());
        items.sort_by_key(|i| i.name.to_lowercase());
        Ok(items)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// (コマンド)ファイルのアイコンを、PNG の data URI で返す。キャッシュは画面側(JS)だけが持つ(メモリの二重持ちを避ける)。
/// `.alumiapp` はミニアプリの画像(無ければ標準のアイコン)。画像・動画は、設定がオンなら中身のプレビュー(作れなければ普通のアイコン)。
///
/// # 引数
/// * `path` - ファイルのパス(登録済みフォルダの中)
///
/// # 戻り値
/// `data:image/png;base64,...`。取り出せなければエラー
#[tauri::command]
pub async fn get_icon(app: AppHandle, path: String) -> Result<String, String> {
    if !in_registered(&app, &path, false) {
        return Err("not_registered".into());
    }
    // ミニアプリのアイコン(.alumiapp)は、ミニアプリのフォルダの画像(無ければ標準のアイコン)
    if let Some(id) = miniapp_id_of_file(&path) {
        let root = miniapps_dir(&app).ok_or_else(|| "no app data dir".to_string())?;
        return Ok(widgets::icon_data_uri(&root, &id).unwrap_or_else(widgets::default_miniapp_icon));
    }
    // キャッシュは画面側(JS)だけが持つ。Rust 側では保持しない(メモリの二重持ちを避ける)
    #[cfg(windows)]
    let png = {
        let preview = app
            .state::<AppState>()
            .config
            .lock_ok()
            .settings
            .preview_thumbnails
            && icon::is_media(&path);
        // 画像・動画は、エクスプローラーの「大アイコン」と同じように中身のプレビューを出す(作れなければ普通のアイコン)。
        // 動画のプレビューは少し時間がかかるので、非同期ランタイムのスレッドを止めないよう別のスレッドで作る
        tauri::async_runtime::spawn_blocking(move || {
            (if preview {
                icon::thumbnail_png(&path)
            } else {
                None
            })
            .or_else(|| icon::icon_png(&path))
        })
        .await
        .map_err(|e| e.to_string())?
    };
    #[cfg(not(windows))]
    let png: Option<Vec<u8>> = None;

    let png = png.ok_or_else(|| "icon not found".to_string())?;
    Ok(format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(png)
    ))
}

/// (コマンド)パスの一覧から、フォルダだけを残す(ドロップされたものの振り分けに使う)。
///
/// # 引数
/// * `paths` - パスの一覧
///
/// # 戻り値
/// フォルダのものだけ
#[tauri::command]
pub async fn filter_dirs(paths: Vec<String>) -> Vec<String> {
    paths
        .into_iter()
        .filter(|p| Path::new(p).is_dir())
        .collect()
}
