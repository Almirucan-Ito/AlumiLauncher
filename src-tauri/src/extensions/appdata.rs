//! ウィジェット・ミニアプリのデータとキャッシュ。
//!
//! それぞれのフォルダ(`widgets\<名前>` / `miniapps\<名前>`)の中に、次のフォルダを作って保存する:
//!   - `data`  … 残しておくデータ(キー 1 つにつき、`<キー>.txt` のファイル 1 つ)。URL を開くミニアプリのブラウザ用の保存場所(`data\webview`)も、ここ
//!   - `cache` … 消えても困らない、作り直せるもの(画像の見本など)
//!
//! 一覧から、ウィジェット・ミニアプリごと、または全部まとめて、データ・キャッシュを消せる。

use std::collections::hash_map::DefaultHasher;
use std::collections::HashMap;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::Serialize;

/// 1 つの値の大きさの上限(バイト)
pub const MAX_VALUE: usize = 64 * 1024;
/// 1 つのフォルダに作れる、データ(キー)の数の上限
const MAX_KEYS: usize = 64;
/// 画像の見本のキャッシュの大きさの上限(これを超えたら、古いものから消す)
pub const THUMB_CACHE_MAX: u64 = 200 * 1024 * 1024;

/// Web ミニアプリのプロファイル(`data\webview`)の中の、消しても困らないキャッシュのフォルダ名
const WEBVIEW_CACHE_NAMES: [&str; 7] = [
    "Cache",
    "Code Cache",
    "GPUCache",
    "ShaderCache",
    "GrShaderCache",
    "DawnCache",
    "GraphiteDawnCache",
];

/// データ・キャッシュのキー名として使えるか調べる(ファイル名になるので、`..` や区切り文字・先頭のドットを避ける)。
///
/// # 引数
/// * `k` - キー名
///
/// # 戻り値
/// 英数字・`_`・`-`・`.` だけで、64 字以下の、空でない名前(先頭が `.` ではない)なら `true`
pub fn valid_key(k: &str) -> bool {
    !k.is_empty()
        && k.len() <= 64
        && !k.starts_with('.')
        && k.chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-' || c == '.')
}

/// ウィジェット・ミニアプリのフォルダ(`root` の下の `id`)を求める。
///
/// # 引数
/// * `root` - widgets または miniapps フォルダ
/// * `id` - フォルダ名
///
/// # 戻り値
/// 実在するフォルダのパス。`id` が不正、またはフォルダが無ければ `None`
pub fn app_dir(root: &Path, id: &str) -> Option<PathBuf> {
    if !crate::extensions::widgets::valid_id(id) {
        return None;
    }
    let d = root.join(id);
    d.is_dir().then_some(d)
}

/// フォルダの中の `<キー>.txt` を全部読んで、キー → 値の表にする。大きすぎる値(`MAX_VALUE` 超)・不正なキー名・読めないものは飛ばす。
///
/// # 引数
/// * `dir` - `data` または `cache` フォルダ
///
/// # 戻り値
/// キーと値の表(最大 `MAX_KEYS` 個)
fn read_keys(dir: &Path) -> HashMap<String, String> {
    let mut out = HashMap::new();
    let Ok(rd) = fs::read_dir(dir) else {
        return out;
    };
    for e in rd.flatten().take(MAX_KEYS) {
        let name = e.file_name().to_string_lossy().into_owned();
        let Some(key) = name.strip_suffix(".txt") else {
            continue;
        };
        if !valid_key(key) || !e.file_type().map(|t| t.is_file()).unwrap_or(false) {
            continue;
        }
        if e.metadata()
            .map(|m| m.len() as usize > MAX_VALUE)
            .unwrap_or(true)
        {
            continue;
        }
        if let Ok(v) = fs::read_to_string(e.path()) {
            out.insert(key.to_string(), v);
        }
    }
    out
}

/// 1 つの値を `<キー>.txt` として保存する。一時ファイルに書いてから置き換えるので、書き込み中に落ちても、ファイルが壊れない。
///
/// # 引数
/// * `dir` - 保存先のフォルダ(無ければ作る)
/// * `key` - キー名(`valid_key` を満たすこと)
/// * `value` - 保存する文字列(`MAX_VALUE` バイトまで)
///
/// # 戻り値
/// `Ok(())`、または失敗の理由(`"invalid key"` / `"too large"` / `"too many keys"` / OS のエラー)
fn write_key(dir: &Path, key: &str, value: &str) -> Result<(), String> {
    if !valid_key(key) {
        return Err("invalid key".into());
    }
    if value.len() > MAX_VALUE {
        return Err("too large".into());
    }
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let file = dir.join(format!("{key}.txt"));
    if !file.exists() && fs::read_dir(dir).map(|r| r.count()).unwrap_or(0) >= MAX_KEYS {
        return Err("too many keys".into());
    }
    // 書き込み中に落ちても、壊れないように、一時ファイルに書いてから置き換える
    let tmp = dir.join(format!(".{key}.tmp"));
    fs::write(&tmp, value.as_bytes()).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &file).map_err(|e| e.to_string())
}

/// `data` フォルダの中身(残しておくデータ)を、すべて読む。
///
/// # 引数
/// * `app` - ウィジェット/ミニアプリのフォルダ
///
/// # 戻り値
/// キー → 値の表
pub fn load(app: &Path) -> HashMap<String, String> {
    read_keys(&app.join("data"))
}
/// データを 1 つ保存する(`data\<キー>.txt`)。
///
/// # 引数
/// * `app` - ウィジェット/ミニアプリのフォルダ
/// * `key`, `value` - `write_key` と同じ
///
/// # 戻り値
/// `Ok(())` または失敗の理由
pub fn set(app: &Path, key: &str, value: &str) -> Result<(), String> {
    write_key(&app.join("data"), key, value)
}
/// キャッシュを 1 つ読む(`cache\<キー>.txt`)。
///
/// # 引数
/// * `app` - ウィジェット/ミニアプリのフォルダ
/// * `key` - キー名
///
/// # 戻り値
/// 値。キーが不正、または無ければ `None`
pub fn cache_get(app: &Path, key: &str) -> Option<String> {
    if !valid_key(key) {
        return None;
    }
    fs::read_to_string(app.join("cache").join(format!("{key}.txt"))).ok()
}
/// キャッシュを 1 つ保存する(`cache\<キー>.txt`)。消えても作り直せるものだけを入れる。
///
/// # 引数
/// * `app` - ウィジェット/ミニアプリのフォルダ
/// * `key`, `value` - `write_key` と同じ
///
/// # 戻り値
/// `Ok(())` または失敗の理由
pub fn cache_set(app: &Path, key: &str, value: &str) -> Result<(), String> {
    write_key(&app.join("cache"), key, value)
}

/// フォルダの中身の大きさを合計する。リンクは辿らず、深さ 8・20000 項目までで打ち切る(巨大なフォルダでも固まらないように)。
///
/// # 引数
/// * `p` - 調べるフォルダ
///
/// # 戻り値
/// 合計のバイト数(読めないものは 0 として数える)
pub fn dir_size(p: &Path) -> u64 {
    fn walk(p: &Path, depth: usize, budget: &mut usize) -> u64 {
        if depth > 8 || *budget == 0 {
            return 0;
        }
        let Ok(rd) = fs::read_dir(p) else { return 0 };
        let mut total = 0;
        for e in rd.flatten() {
            if *budget == 0 {
                break;
            }
            *budget -= 1;
            let Ok(ft) = e.file_type() else { continue };
            if ft.is_symlink() {
                continue;
            }
            if ft.is_dir() {
                total += walk(&e.path(), depth + 1, budget);
            } else if let Ok(m) = e.metadata() {
                total += m.len();
            }
        }
        total
    }
    let mut budget = 20_000;
    walk(p, 0, &mut budget)
}

/// URL を開くミニアプリのブラウザ用の保存場所(`data\webview`)の中から、消しても困らないキャッシュのフォルダ(`Cache` など)を探す。深さ 4 まで。
///
/// # 引数
/// * `base` - 探し始めるフォルダ
/// * `depth` - いまの深さ(最初は 0)
/// * `out` - 見つかったフォルダのパスを足す先
fn webview_caches(base: &Path, depth: usize, out: &mut Vec<PathBuf>) {
    if depth > 4 {
        return;
    }
    let Ok(rd) = fs::read_dir(base) else { return };
    for e in rd.flatten() {
        let Ok(ft) = e.file_type() else { continue };
        if !ft.is_dir() || ft.is_symlink() {
            continue;
        }
        let name = e.file_name().to_string_lossy().into_owned();
        if WEBVIEW_CACHE_NAMES.contains(&name.as_str()) {
            out.push(e.path());
        } else {
            webview_caches(&e.path(), depth + 1, out);
        }
    }
}

/// データとキャッシュの、使っている大きさ(バイト)。
#[derive(Serialize, Debug, PartialEq, Clone)]
pub struct Usage {
    pub data: u64,
    pub cache: u64,
}

/// データ・キャッシュの大きさを求める。ブラウザ用の保存場所の中のキャッシュは、「データ」ではなく「キャッシュ」に数える。
///
/// # 引数
/// * `app` - ウィジェット/ミニアプリのフォルダ
///
/// # 戻り値
/// `Usage`(データの大きさ・キャッシュの大きさ)
pub fn usage(app: &Path) -> Usage {
    let mut caches = Vec::new();
    webview_caches(&app.join("data").join("webview"), 0, &mut caches);
    let wv_cache: u64 = caches.iter().map(|c| dir_size(c)).sum();
    Usage {
        data: dir_size(&app.join("data")).saturating_sub(wv_cache),
        cache: dir_size(&app.join("cache")) + wv_cache,
    }
}

/// データを消す(`data` フォルダごと)。
///
/// # 引数
/// * `app` - ウィジェット/ミニアプリのフォルダ
///
/// # 戻り値
/// `Ok(())` または失敗の理由
pub fn clear_data(app: &Path) -> Result<(), String> {
    let d = app.join("data");
    if d.exists() {
        fs::remove_dir_all(&d).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// キャッシュを消す(`cache` フォルダと、ブラウザ用の保存場所の中のキャッシュ。Cookie などのデータは残る)。
///
/// # 引数
/// * `app` - ウィジェット/ミニアプリのフォルダ
///
/// # 戻り値
/// `Ok(())` または失敗の理由
pub fn clear_cache(app: &Path) -> Result<(), String> {
    let c = app.join("cache");
    if c.exists() {
        fs::remove_dir_all(&c).map_err(|e| e.to_string())?;
    }
    let mut caches = Vec::new();
    webview_caches(&app.join("data").join("webview"), 0, &mut caches);
    for d in caches {
        let _ = fs::remove_dir_all(d);
    }
    Ok(())
}

/// 画像の見本(サムネイル)のキャッシュの名前を決める。元の画像の場所・更新時刻・大きさから作るので、画像が変われば別の名前になる(古い見本を使い回さない)。
///
/// # 引数
/// * `p` - 元の画像のパス
///
/// # 戻り値
/// 16 桁の 16 進数の名前。ファイルの情報が読めなければ `None`
pub fn thumb_key(p: &Path) -> Option<String> {
    let m = fs::metadata(p).ok()?;
    let t = m
        .modified()
        .ok()?
        .duration_since(UNIX_EPOCH)
        .ok()?
        .as_secs();
    let mut h = DefaultHasher::new();
    p.hash(&mut h);
    t.hash(&mut h);
    m.len().hash(&mut h);
    Some(format!("{:016x}", h.finish()))
}

/// キャッシュのフォルダが `max_bytes` を超えたら、古い(更新時刻の早い)ファイルから消して、収める。
///
/// # 引数
/// * `dir` - キャッシュのフォルダ(直下のファイルだけが対象)
/// * `max_bytes` - 残してよい合計の大きさ
pub fn prune(dir: &Path, max_bytes: u64) {
    let Ok(rd) = fs::read_dir(dir) else { return };
    let mut files: Vec<(std::time::SystemTime, u64, PathBuf)> = rd
        .flatten()
        .filter_map(|e| {
            let m = e.metadata().ok()?;
            m.is_file()
                .then(|| (m.modified().unwrap_or(UNIX_EPOCH), m.len(), e.path()))
        })
        .collect();
    let mut total: u64 = files.iter().map(|f| f.1).sum();
    if total <= max_bytes {
        return;
    }
    files.sort_by_key(|f| f.0);
    for (_, len, path) in files {
        if total <= max_bytes {
            break;
        }
        if fs::remove_file(path).is_ok() {
            total = total.saturating_sub(len);
        }
    }
}

#[cfg(test)]
#[path = "appdata_tests.rs"]
mod tests;
