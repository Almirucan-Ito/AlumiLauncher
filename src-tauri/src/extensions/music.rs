//! 音楽プレーヤー(ミニアプリ「ミュージック」とウィジェット)で再生する、ローカルの音声ファイルの窓口。
//!
//! 画面側は、利用者が選んだ(または、フォルダから見つけた)音声ファイルを「登録」して、
//! 登録の印(token)を受け取る。再生は `miniapp` プロトコルの `/__music/<token>` から読み込む。
//! 登録できるのは、実在する音声ファイル(拡張子で判定)だけ。それ以外のファイルは、渡さない。

use std::collections::HashMap;
use std::fs;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

use serde::Serialize;

/// 再生できる音声の拡張子
pub const AUDIO_EXT: [&str; 9] = [
    "mp3", "flac", "wav", "ogg", "oga", "opus", "m4a", "aac", "weba",
];

/// 画像ビューアで開ける画像の拡張子
pub const IMAGE_EXT: [&str; 7] = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"];
/// 画像 1 枚の大きさの上限(バイト)
pub const MAX_IMAGE: u64 = 40 * 1024 * 1024;

/// 一度に登録・探索する曲数の上限
pub const MAX_TRACKS: usize = 3000;
/// 登録を覚えておく数の上限(超えたら、古い登録をまとめて捨てる)
const MAX_REGISTRY: usize = 8000;
/// 1 回の応答で返す最大のバイト数(長い曲でも、メモリを使いすぎないように、少しずつ返す)
const CHUNK: u64 = 2 * 1024 * 1024;

/// 登録した 1 曲(または 1 枚の画像)の情報。画面へ返す。
/// `token` で `/__music/<token>` などから読み込む。
#[derive(Serialize, Clone, Debug)]
pub struct Track {
    pub token: String,
    /// 表示名(拡張子を除いたファイル名)
    pub name: String,
    pub path: String,
}

/// 登録したファイルの「印(token)」と、実際のパスの対応表。
/// 画面側は、パスではなく印だけを使う(任意のファイルを読ませないため)。登録できるのは、実在する音声・画像だけ。
#[derive(Default)]
pub struct Registry {
    by_token: HashMap<String, PathBuf>,
    by_path: HashMap<PathBuf, String>,
    seq: u64,
}

/// 画像ファイルか、拡張子で判定する。
///
/// # 引数
/// * `p` - ファイルのパス
///
/// # 戻り値
/// `IMAGE_EXT` に含まれる拡張子なら `true`(大文字・小文字は区別しない)
pub fn is_image(p: &Path) -> bool {
    p.extension()
        .map(|e| IMAGE_EXT.contains(&e.to_string_lossy().to_lowercase().as_str()))
        .unwrap_or(false)
}

/// 音声ファイルか、拡張子で判定する。
///
/// # 引数
/// * `p` - ファイルのパス
///
/// # 戻り値
/// `AUDIO_EXT` に含まれる拡張子なら `true`(大文字・小文字は区別しない)
pub fn is_audio(p: &Path) -> bool {
    p.extension()
        .map(|e| AUDIO_EXT.contains(&e.to_string_lossy().to_lowercase().as_str()))
        .unwrap_or(false)
}

impl Registry {
    /// 音声ファイルを登録して、再生用の印を返す。
    ///
    /// # 引数
    /// * `p` - 音声ファイルのパス
    ///
    /// # 戻り値
    /// 登録した曲の情報。音声でない・存在しないファイルは `None`
    pub fn register(&mut self, p: &Path) -> Option<Track> {
        self.register_kind(p, is_audio)
    }

    /// 画像ファイルを登録して、表示用の印を返す。
    ///
    /// # 引数
    /// * `p` - 画像ファイルのパス
    ///
    /// # 戻り値
    /// 登録した画像の情報。画像でない・存在しないファイルは `None`
    pub fn register_image(&mut self, p: &Path) -> Option<Track> {
        self.register_kind(p, is_image)
    }

    /// ファイルを登録する(種類の判定は `ok` に任せる)。同じファイルは、同じ印を返す。登録が `MAX_REGISTRY` 件に達したら、古い登録をまとめて捨てる。
    ///
    /// # 引数
    /// * `p` - ファイルのパス
    /// * `ok` - 登録してよい種類か判定する関数(`is_audio` / `is_image`)
    ///
    /// # 戻り値
    /// 登録したものの情報。種類が違う・存在しないファイルは `None`
    fn register_kind(&mut self, p: &Path, ok: fn(&Path) -> bool) -> Option<Track> {
        if !ok(p) || !p.is_file() {
            return None;
        }
        let canon = fs::canonicalize(p).ok()?;
        if self.by_token.len() >= MAX_REGISTRY {
            self.by_token.clear();
            self.by_path.clear();
        }
        let token = match self.by_path.get(&canon) {
            Some(t) => t.clone(),
            None => {
                self.seq += 1;
                let t = format!("t{}", self.seq);
                self.by_token.insert(t.clone(), canon.clone());
                self.by_path.insert(canon, t.clone());
                t
            }
        };
        Some(Track {
            token,
            name: p
                .file_stem()
                .map(|s| s.to_string_lossy().into_owned())
                .unwrap_or_default(),
            path: p.to_string_lossy().into_owned(),
        })
    }

    /// 印から、登録してあるファイルの実際のパスを求める。
    ///
    /// # 引数
    /// * `token` - 登録のときに返した印
    ///
    /// # 戻り値
    /// 登録されていれば、(正規化した)パス。無ければ `None`
    pub fn get(&self, token: &str) -> Option<PathBuf> {
        self.by_token.get(token).cloned()
    }
}

/// フォルダの中の音声ファイルを、名前順に集める(ジャンクション・リンクは辿らない)。
///
/// # 引数
/// * `dir` - 探すフォルダ
/// * `depth` - いまの深さ(最初は 0。6 を超えたら打ち切り)
/// * `out` - 見つかったパスを足す先(`MAX_TRACKS` 個まで)
pub fn scan_dir(dir: &Path, depth: usize, out: &mut Vec<PathBuf>) {
    scan_dir_kind(dir, depth, out, is_audio)
}

/// フォルダの中の画像ファイルを、名前順に集める。
///
/// # 引数
/// * `dir`, `depth`, `out` - `scan_dir` と同じ
pub fn scan_images(dir: &Path, depth: usize, out: &mut Vec<PathBuf>) {
    scan_dir_kind(dir, depth, out, is_image)
}

/// フォルダを再帰的にたどって、`ok` が通るファイルを集める(名前の小文字順。リンクは辿らない)。
///
/// # 引数
/// * `dir`, `depth`, `out` - `scan_dir` と同じ
/// * `ok` - 集める種類か判定する関数
fn scan_dir_kind(dir: &Path, depth: usize, out: &mut Vec<PathBuf>, ok: fn(&Path) -> bool) {
    if depth > 6 || out.len() >= MAX_TRACKS {
        return;
    }
    let Ok(rd) = fs::read_dir(dir) else { return };
    let mut entries: Vec<_> = rd.flatten().collect();
    entries.sort_by_key(|e| e.file_name().to_string_lossy().to_lowercase());
    for e in entries {
        if out.len() >= MAX_TRACKS {
            return;
        }
        let Ok(ft) = e.file_type() else { continue };
        if ft.is_symlink() {
            continue;
        }
        let p = e.path();
        if ft.is_dir() {
            scan_dir_kind(&p, depth + 1, out, ok);
        } else if ft.is_file() && ok(&p) {
            out.push(p);
        }
    }
}

/// 音声・画像ファイルの拡張子から、`Content-Type` を決める。
///
/// # 引数
/// * `p` - ファイルのパス
///
/// # 戻り値
/// MIME タイプ。知らない拡張子は `application/octet-stream`
fn mime(p: &Path) -> &'static str {
    match p
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .as_deref()
    {
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("bmp") => "image/bmp",
        Some("svg") => "image/svg+xml",
        Some("mp3") => "audio/mpeg",
        Some("flac") => "audio/flac",
        Some("wav") => "audio/wav",
        Some("ogg" | "oga" | "opus") => "audio/ogg",
        Some("m4a") => "audio/mp4",
        Some("aac") => "audio/aac",
        Some("weba") => "audio/webm",
        _ => "application/octet-stream",
    }
}

/// `Range: bytes=a-b` ヘッダーを読む。
///
/// # 引数
/// * `h` - ヘッダーの値(例: `bytes=100-199` / `bytes=100-`)
///
/// # 戻り値
/// (開始位置, 終了位置)。終了が省略されていれば終了は `None`。読めなければ `None`
pub(crate) fn parse_range(h: &str) -> Option<(u64, Option<u64>)> {
    let spec = h.trim().strip_prefix("bytes=")?;
    let (a, b) = spec.split_once('-')?;
    let start: u64 = a.trim().parse().ok()?;
    let end = if b.trim().is_empty() {
        None
    } else {
        Some(b.trim().parse().ok()?)
    };
    Some((start, end))
}

/// 音声ファイルの一部(Range)を返す。再生位置の移動(シーク)ができるよう、必ず 206 で返す。
/// 1 回に返す量は `CHUNK`(2MB)までに絞る(長い曲でも、メモリを使いすぎないように)。
///
/// # 引数
/// * `path` - 音声ファイルのパス
/// * `range` - `Range` ヘッダーの値(無ければ先頭から)
///
/// # 戻り値
/// HTTP の応答(206 = 一部 / 416 = 範囲が外 / 404 = 開けない / 200 = 空のファイル)
pub fn serve(path: &Path, range: Option<&str>) -> tauri::http::Response<Vec<u8>> {
    let build = |status: u16| {
        tauri::http::Response::builder()
            .status(status)
            .header("Access-Control-Allow-Origin", "*")
            .header("Cache-Control", "no-store")
    };
    let Ok(mut f) = fs::File::open(path) else {
        return build(404).body(Vec::new()).unwrap_or_default();
    };
    let Ok(len) = f.metadata().map(|m| m.len()) else {
        return build(404).body(Vec::new()).unwrap_or_default();
    };
    if len == 0 {
        return build(200)
            .header("Content-Type", mime(path))
            .header("Accept-Ranges", "bytes")
            .body(Vec::new())
            .unwrap_or_default();
    }
    let (start, end) = range.and_then(parse_range).unwrap_or((0, None));
    if start >= len {
        return build(416)
            .header("Content-Range", format!("bytes */{len}"))
            .body(Vec::new())
            .unwrap_or_default();
    }
    let end = end
        .unwrap_or(len - 1)
        .min(len - 1)
        .min(start + CHUNK - 1)
        .max(start);
    let mut buf = vec![0u8; (end - start + 1) as usize];
    if f.seek(SeekFrom::Start(start)).is_err() || f.read_exact(&mut buf).is_err() {
        return build(500).body(Vec::new()).unwrap_or_default();
    }
    build(206)
        .header("Content-Type", mime(path))
        .header("Accept-Ranges", "bytes")
        .header("Content-Range", format!("bytes {start}-{end}/{len}"))
        .body(buf)
        .unwrap_or_default()
}

/// 画像ファイル 1 枚を、まるごと返す(`MAX_IMAGE` を超える大きなものは返さない)。
///
/// # 引数
/// * `path` - 画像ファイルのパス
///
/// # 戻り値
/// HTTP の応答(200 = 画像 / 404 = 画像でない・大きすぎる・読めない)
pub fn serve_image(path: &Path) -> tauri::http::Response<Vec<u8>> {
    let build = |status: u16| {
        tauri::http::Response::builder()
            .status(status)
            .header("Access-Control-Allow-Origin", "*")
            .header("Cache-Control", "max-age=300")
    };
    if !is_image(path)
        || fs::metadata(path)
            .map(|m| m.len() > MAX_IMAGE)
            .unwrap_or(true)
    {
        return build(404).body(Vec::new()).unwrap_or_default();
    }
    match fs::read(path) {
        Ok(bytes) => build(200)
            .header("Content-Type", mime(path))
            .body(bytes)
            .unwrap_or_default(),
        Err(_) => build(404).body(Vec::new()).unwrap_or_default(),
    }
}

/// 画像の見本(PNG)を返す。
///
/// # 引数
/// * `png` - 見本の PNG のバイト列。作れなかったときは `None`
///
/// # 戻り値
/// HTTP の応答(200 = PNG / 404 = 見本なし)
pub fn serve_thumb(png: Option<Vec<u8>>) -> tauri::http::Response<Vec<u8>> {
    let build = |status: u16| {
        tauri::http::Response::builder()
            .status(status)
            .header("Access-Control-Allow-Origin", "*")
            .header("Cache-Control", "max-age=300")
    };
    match png {
        Some(b) => build(200)
            .header("Content-Type", "image/png")
            .body(b)
            .unwrap_or_default(),
        None => build(404).body(Vec::new()).unwrap_or_default(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_audio_files_are_registered_and_served_in_ranges() {
        let dir = std::env::temp_dir().join(format!("alumi-music-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("sub")).unwrap();
        let a = dir.join("a.mp3");
        fs::write(&a, (0..=255u8).collect::<Vec<_>>()).unwrap();
        fs::write(dir.join("sub").join("b.FLAC"), [1u8; 10]).unwrap();
        fs::write(dir.join("secret.txt"), "x").unwrap();
        let mut reg = Registry::default();
        let t = reg.register(&a).unwrap();
        assert_eq!(t.name, "a");
        assert_eq!(
            reg.register(&a).unwrap().token,
            t.token,
            "同じファイルは同じ印"
        );
        assert!(
            reg.register(&dir.join("secret.txt")).is_none(),
            "音声以外は登録しない"
        );
        assert!(reg.register(&dir.join("missing.mp3")).is_none());
        assert_eq!(reg.get(&t.token).unwrap(), fs::canonicalize(&a).unwrap());
        let mut found = Vec::new();
        scan_dir(&dir, 0, &mut found);
        assert_eq!(found.len(), 2);

        let r = serve(&a, Some("bytes=10-19"));
        assert_eq!(r.status(), 206);
        assert_eq!(r.body().as_slice(), &(10..=19u8).collect::<Vec<_>>()[..]);
        assert_eq!(r.headers().get("Content-Range").unwrap(), "bytes 10-19/256");
        assert_eq!(serve(&a, Some("bytes=250-")).body().len(), 6);
        assert_eq!(serve(&a, None).status(), 206);
        assert_eq!(serve(&a, Some("bytes=999-")).status(), 416);
        // 画像: 登録は画像だけ。音声は、画像としては登録しない
        fs::write(dir.join("p.PNG"), [1u8; 4]).unwrap();
        assert!(reg.register_image(&dir.join("p.PNG")).is_some());
        assert!(reg.register_image(&a).is_none());
        assert!(reg.register(&dir.join("p.PNG")).is_none());
        let mut imgs = Vec::new();
        scan_images(&dir, 0, &mut imgs);
        assert_eq!(imgs.len(), 1);
        assert_eq!(serve_image(&dir.join("p.PNG")).status(), 200);
        assert_eq!(serve_image(&dir.join("secret.txt")).status(), 404);
        let _ = fs::remove_dir_all(&dir);
    }
}
