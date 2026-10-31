//! ファイルの移動・追加・削除・新規作成・読み書きなど、フォルダの中のファイルの操作。

use crate::config::store::data_dir;
use crate::config::store::read_config;
use crate::files::listing::get_launcher_folder;
use crate::files::listing::LAUNCHER_DIR;
use crate::files::roots::in_registered;
use crate::platform::shortcut;
use serde::Serialize;
use std::fs;
use std::path::Path;
use std::path::PathBuf;
use tauri::AppHandle;

/// ファイルを `dest_dir` へ移動する(同名があれば連番を付ける)。ドライブをまたぐときは、コピーしてから元を削除する。
///
/// # 引数
/// * `src` - 移動するファイル
/// * `dest_dir` - 移動先のフォルダ
///
/// # 戻り値
/// 移動後のパス。失敗したら理由
pub(crate) fn move_file(src: &Path, dest_dir: &Path) -> Result<PathBuf, String> {
    let name = src.file_name().ok_or_else(|| "invalid path".to_string())?;
    let dest = unique_path(dest_dir.join(name));
    if fs::rename(src, &dest).is_err() {
        fs::copy(src, &dest).map_err(|e| e.to_string())?;
        fs::remove_file(src).map_err(|e| e.to_string())?;
    }
    Ok(dest)
}

/// (コマンド)登録済みフォルダ内のファイルを、別の登録済みフォルダ(またはホームの launcherFolder)へ移動する。
///
/// # 引数
/// * `path` - 移動するファイル(登録フォルダの中)
/// * `target_dir` - 移動先のフォルダ(登録フォルダ)
///
/// # 戻り値
/// 移動後のパス。登録外・ファイルでない・移動先なしなどのときは、エラーの理由
#[tauri::command]
pub async fn move_item(app: AppHandle, path: String, target_dir: String) -> Result<String, String> {
    if !in_registered(&app, &path, false) || !in_registered(&app, &target_dir, true) {
        return Err("not_registered".into());
    }
    let src = PathBuf::from(&path);
    if !src.is_file() {
        return Err("not a file".into());
    }
    let dest_dir = PathBuf::from(&target_dir);
    if !dest_dir.is_dir() {
        return Err("not_found".into());
    }
    move_file(&src, &dest_dir).map(|p| p.to_string_lossy().into_owned())
}

/// (コマンド)`src_dir` の直下のファイルを、すべて `dst_dir` へ移動する。フォルダ同士を一つにまとめるときに使う。
///
/// # 引数
/// * `src_dir`, `dst_dir` - どちらも登録済みフォルダ
///
/// # 戻り値
/// 移動後のパスの一覧(元に戻す/やり直しで使う)
#[tauri::command]
pub async fn move_all(
    app: AppHandle,
    src_dir: String,
    dst_dir: String,
) -> Result<Vec<String>, String> {
    if !in_registered(&app, &src_dir, true) || !in_registered(&app, &dst_dir, true) {
        return Err("not_registered".into());
    }
    let (src, dst) = (PathBuf::from(&src_dir), PathBuf::from(&dst_dir));
    if !src.is_dir() || !dst.is_dir() {
        return Err("not_found".into());
    }
    // 同じフォルダへは、動かさない(動かすと、すべてのファイルが「名前 (2)」に付け替わってしまう)
    if fs::canonicalize(&src).ok() == fs::canonicalize(&dst).ok() {
        return Ok(Vec::new());
    }
    let mut moved = Vec::new();
    for entry in fs::read_dir(&src).map_err(|e| e.to_string())?.flatten() {
        if entry.file_type().map(|t| t.is_file()).unwrap_or(false) {
            moved.push(
                move_file(&entry.path(), &dst)?
                    .to_string_lossy()
                    .into_owned(),
            );
        }
    }
    Ok(moved)
}

/// `folders` の下にある、一覧から外れて使われなくなったフォルダを片付ける(起動時に呼ぶ。元に戻す/やり直しが効く間は残すため、起動時だけ)。
/// 中にファイルが残っていれば、失わないように、ホームの launcherFolder へ移してから、フォルダを削除する。
///
/// # 引数
/// * `app` - アプリのハンドル
pub(crate) fn cleanup_unused_folders(app: &AppHandle) {
    let Ok(base) = data_dir(app) else { return };
    let (root, home) = (base.join("folders"), base.join(LAUNCHER_DIR));
    let Ok(rd) = fs::read_dir(&root) else { return };
    let full = read_config(app);
    let used: Vec<PathBuf> = full
        .folders
        .iter()
        .chain(full.presets.values().flat_map(|p| p.folders.iter()))
        .filter_map(|f| fs::canonicalize(&f.path).ok())
        .collect();
    for entry in rd.flatten() {
        let dir = entry.path();
        if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            continue;
        }
        if fs::canonicalize(&dir)
            .map(|c| used.contains(&c))
            .unwrap_or(true)
        {
            continue; // 使用中(または確認できない)ものは触らない
        }
        if let Ok(files) = fs::read_dir(&dir) {
            for f in files.flatten() {
                if f.file_type().map(|t| t.is_file()).unwrap_or(false)
                    && fs::create_dir_all(&home).is_ok()
                {
                    let _ = move_file(&f.path(), &home);
                }
            }
        }
        let _ = fs::remove_dir(&dir); // 空になっていれば削除(まだ中身が残っていれば何もしない)
    }
}

/// (コマンド)ホームのアイコン同士を重ねたときに、新しいフォルダを作って、アイコン(ファイル)を中に移す。
/// フォルダは `<データ>\folders\<id>` に作る(launcherFolder の外。ホームのアイコン一覧に混ざらないように)。一覧への登録は、画面側が行う。
///
/// # 引数
/// * `id` - 新しいフォルダの ID(英数字・`-`・`_`、64 字まで)
/// * `paths` - 中に入れるファイル(登録フォルダの中のもの)
///
/// # 戻り値
/// 作ったフォルダのパス
#[tauri::command]
pub async fn create_folder(
    app: AppHandle,
    id: String,
    paths: Vec<String>,
) -> Result<String, String> {
    if id.is_empty()
        || id.len() > 64
        || !id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err("invalid id".into());
    }
    for p in &paths {
        if !in_registered(&app, p, false) {
            return Err("not_registered".into());
        }
    }
    let dir = data_dir(&app)
        .map_err(|e| e.to_string())?
        .join("folders")
        .join(&id);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    for p in paths {
        let src = PathBuf::from(&p);
        if src.is_file() {
            move_file(&src, &dir)?;
        }
    }
    Ok(dir.to_string_lossy().into_owned())
}

/// (コマンド)登録済みフォルダ内のファイルだけを、ごみ箱へ移動する(完全削除ではない)。
///
/// # 引数
/// * `path` - 削除するファイル
#[tauri::command]
pub async fn delete_item(app: AppHandle, path: String) -> Result<(), String> {
    let target = fs::canonicalize(&path).map_err(|e| e.to_string())?;
    if !target.is_file() {
        return Err("not a file".into());
    }
    if !in_registered(&app, &path, false) {
        return Err("not inside a registered folder".into());
    }
    #[cfg(windows)]
    {
        shortcut::recycle(&path)
    }
    #[cfg(not(windows))]
    {
        Err("unsupported".into())
    }
}

/// Windows が、ファイル名に使えない「予約名」(CON・NUL・COM1・LPT1 など。拡張子の前の部分)か。
///
/// # 引数
/// * `stem` - 拡張子を除いた名前
fn is_reserved_name(stem: &str) -> bool {
    let up = stem.to_uppercase();
    ["CON", "PRN", "AUX", "NUL"].contains(&up.as_str())
        || ((up.starts_with("COM") || up.starts_with("LPT"))
            && up.len() == 4
            && up.as_bytes()[3].is_ascii_digit())
}

/// ファイルの新しい名前として使えるか調べる。
/// ・使えない文字(`\ / : * ? " < > |` と制御文字)・空・長すぎる(200 字まで)・前後の空白・終わりの `.`・予約名は、使えない
/// ・**拡張子は変えられない**(`.lnk` を `.exe` に変えるなど、ファイルの種類をすり替えられないように)。拡張子の無いファイルには、`.` を含む名前を付けられない
///
/// # 引数
/// * `old` - いまのファイル
/// * `new_name` - 新しい名前(拡張子を含む。フォルダの部分は含めない)
///
/// # 戻り値
/// 使えるなら `Ok`。使えないときは、理由(`invalid_name` / `extension_changed`)
pub(crate) fn check_new_file_name(old: &Path, new_name: &str) -> Result<(), &'static str> {
    if new_name.is_empty()
        || new_name.chars().count() > 200
        || new_name != new_name.trim()
        || new_name.ends_with('.')
        || new_name
            .chars()
            .any(|c| c.is_control() || "\\/:*?\"<>|".contains(c))
        || is_reserved_name(new_name.split('.').next().unwrap_or(new_name))
    {
        return Err("invalid_name");
    }
    let old_ext = old
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    let same_ext = if old_ext.is_empty() {
        !new_name.contains('.')
    } else {
        new_name.to_lowercase().ends_with(&format!(".{old_ext}"))
            && new_name.len() > old_ext.len() + 1
    };
    if same_ext {
        Ok(())
    } else {
        Err("extension_changed")
    }
}

/// ファイルの名前を、同じフォルダの中で変える。別のファイルがすでにあれば、上書きしない。大文字・小文字だけの変更は、できる。
///
/// # 引数
/// * `src` - 名前を変えるファイル
/// * `new_name` - 新しい名前(拡張子を含む)
///
/// # 戻り値
/// 変えたあとのパス。使えない名前・同名のファイルがある・変えられないときは、理由
pub(crate) fn rename_file(src: &Path, new_name: &str) -> Result<PathBuf, String> {
    check_new_file_name(src, new_name).map_err(String::from)?;
    let parent = src.parent().ok_or_else(|| "invalid path".to_string())?;
    let dest = parent.join(new_name);
    let cur = src
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    if cur == new_name {
        return Ok(src.to_path_buf()); // 同じ名前: 何もしない
    }
    // 大文字・小文字だけ違う名前は、同じファイルなので通す(Windows は、名前の大文字・小文字を区別しないため、`exists` が `true` になる)
    if dest.exists() && cur.to_lowercase() != new_name.to_lowercase() {
        return Err("exists".into());
    }
    fs::rename(src, &dest).map_err(|e| e.to_string())?;
    Ok(dest)
}

/// (コマンド)登録済みフォルダ内のファイルの名前を、同じフォルダの中で変える(元のファイルの名前が変わる)。
///
/// # 引数
/// * `path` - 名前を変えるファイル(登録フォルダの中)
/// * `new_name` - 新しい名前(拡張子を含む。拡張子は、変えられない)
///
/// # 戻り値
/// 変えたあとのパス。登録外・ファイルでない・使えない名前・同名がある、などのときは、エラーの理由
#[tauri::command]
pub async fn rename_item(app: AppHandle, path: String, new_name: String) -> Result<String, String> {
    if !in_registered(&app, &path, false) {
        return Err("not_registered".into());
    }
    let src = PathBuf::from(&path);
    if !src.is_file() {
        return Err("not a file".into());
    }
    rename_file(&src, &new_name).map(|p| p.to_string_lossy().into_owned())
}

/// 同じ名前のファイルがあれば、`名前 (2).拡張子`、`名前 (3).拡張子` … と連番を付けた、まだ無い名前にする。
///
/// # 引数
/// * `path` - 作りたいパス
///
/// # 戻り値
/// まだ存在しないパス
pub(crate) fn unique_path(path: PathBuf) -> PathBuf {
    if !path.exists() {
        return path;
    }
    let stem = path
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();
    let ext = path
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();
    let dir = path.parent().map(Path::to_path_buf).unwrap_or_default();
    // 2, 3, 4 … と数を増やして、まだ無い名前が見つかるまで探す(無限のイテレータなので、必ず見つかる。見つからなければ、元の名前を返す)
    (2..)
        .map(|n| dir.join(format!("{stem} ({n}){ext}")))
        .find(|p| !p.exists())
        .unwrap_or(path)
}

/// (コマンド)ドロップされたファイルを、開いているフォルダに追加する(元の場所からは無くなる = 移動)。追加先は登録済みフォルダだけ。
///
/// # 引数
/// * `dir` - 追加先のフォルダ
/// * `paths` - ドロップされたファイル
///
/// # 戻り値
/// 追加できた数
#[tauri::command]
pub async fn add_to_folder(
    app: AppHandle,
    dir: String,
    paths: Vec<String>,
) -> Result<usize, String> {
    // 追加先は登録済みフォルダだけ(任意の場所にファイルを作られないように)
    if !in_registered(&app, &dir, true) {
        return Err("not_registered".into());
    }
    add_paths_into(Path::new(&dir), paths)
}

/// ホームへの追加の結果。`added` は追加できた数、`path` は追加先(launcherFolder)のパス。
#[derive(Serialize)]
pub(crate) struct LauncherAdd {
    pub(crate) added: usize,
    /// 追加先(launcherFolder)のパス
    pub(crate) path: String,
}

/// (コマンド)ホーム画面にドロップされたショートカット・ファイルを、データ保持用フォルダの `launcherFolder` に保存する。保存したものは、フォルダではなくアプリのアイコンとして、ホームに直接並ぶ。
///
/// # 引数
/// * `paths` - ドロップされたファイル
///
/// # 戻り値
/// 追加できた数と、追加先のパス
#[tauri::command]
pub async fn add_to_launcher_folder(
    app: AppHandle,
    paths: Vec<String>,
) -> Result<LauncherAdd, String> {
    let path = get_launcher_folder(app).await?;
    let added = add_paths_into(Path::new(&path), paths)?;
    Ok(LauncherAdd { added, path })
}

/// ファイルを `dir` に移動して追加する(元の場所からは無くなる。同名があれば連番)。ファイルでないものは飛ばす。
///
/// # 引数
/// * `dir` - 追加先のフォルダ(実在すること)
/// * `paths` - 追加するファイル
///
/// # 戻り値
/// 追加できた数。1 つも追加できず、失敗があったときは、その理由
pub(crate) fn add_paths_into(dir: &Path, paths: Vec<String>) -> Result<usize, String> {
    if !dir.is_dir() {
        return Err("not_found".into());
    }
    let (mut added, mut first_err) = (0usize, None::<String>);
    for p in paths {
        let src = PathBuf::from(&p);
        if !src.is_file() {
            continue;
        }
        match move_file(&src, dir) {
            Ok(_) => added += 1,
            Err(e) => first_err = first_err.or(Some(e)),
        }
    }
    match (added, first_err) {
        (0, Some(e)) => Err(e),
        _ => Ok(added),
    }
}
