//! ドロップされたフォルダの取り込み(ウィジェット・ミニアプリとして、コピーする)。

use super::*;

/// 取り込み(インストール)できたものの情報。
#[derive(Serialize, Debug, PartialEq)]
pub struct Installed {
    /// "widget" か "miniapp"
    pub kind: String,
    pub id: String,
    pub name: String,
}

/// 一度に取り込むフォルダの上限(ファイル数・合計の大きさ・深さ)
pub(crate) const MAX_INSTALL_FILES: usize = 2000;

/// 取り込むフォルダの合計の大きさの上限(バイト)。
pub(crate) const MAX_INSTALL_BYTES: u64 = 1024 * 1024 * 1024;

/// 取り込むフォルダの深さの上限。
pub(crate) const MAX_INSTALL_DEPTH: usize = 8;

/// フォルダを、上限(深さ・ファイル数・合計の大きさ)の範囲でコピーする。リンクは辿らない(フォルダの外のファイルを取り込まないため)。
///
/// # 引数
/// * `src` - コピー元のフォルダ
/// * `dst` - コピー先のフォルダ(無ければ作る)
/// * `depth` - いまの深さ(最初は 0)
/// * `files`, `bytes` - これまでにコピーした数と大きさ(全体で数えるため、呼び出しをまたいで受け渡す)
///
/// # 戻り値
/// `Ok(())` または、上限を超えた・コピーに失敗した理由(`"too deep"` / `"too large"` など)
pub(crate) fn copy_limited(
    src: &Path,
    dst: &Path,
    depth: usize,
    files: &mut usize,
    bytes: &mut u64,
) -> Result<(), String> {
    if depth > MAX_INSTALL_DEPTH {
        return Err("too deep".into());
    }
    fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    for e in fs::read_dir(src).map_err(|e| e.to_string())?.flatten() {
        let ft = e.file_type().map_err(|e| e.to_string())?;
        if ft.is_symlink() {
            continue; // リンクは辿らない(フォルダの外のファイルを取り込まないように)
        }
        let name = e.file_name();
        if ft.is_dir() {
            copy_limited(&e.path(), &dst.join(&name), depth + 1, files, bytes)?;
        } else if ft.is_file() {
            *files += 1;
            *bytes += e.metadata().map_err(|e| e.to_string())?.len();
            if *files > MAX_INSTALL_FILES || *bytes > MAX_INSTALL_BYTES {
                return Err("too large".into());
            }
            fs::copy(e.path(), dst.join(&name)).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// 取り込み先のフォルダ名を、元のフォルダ名から作る(使えない文字は `-` にして、64 字までにする)。
///
/// # 引数
/// * `src` - 取り込むフォルダのパス
///
/// # 戻り値
/// フォルダ名。作れなければ `"item"`
pub(crate) fn install_id(src: &Path) -> String {
    let raw = src
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    let id: String = raw
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.' {
                c
            } else {
                '-'
            }
        })
        .collect();
    let id = id
        .trim_matches(|c| c == '.' || c == '-')
        .chars()
        .take(64)
        .collect::<String>();
    if id.is_empty() {
        "item".into()
    } else {
        id
    }
}

/// ドロップされたフォルダが、ミニアプリ(`miniapp.json`)かウィジェット(`widget.json`)なら、それぞれのフォルダへコピーする(同じ名前があれば置き換える = 更新)。
/// いったん一時フォルダへコピーし、古いものを脇へ移してから差し替えるので、途中で失敗しても元に戻る。
///
/// # 引数
/// * `src` - ドロップされたフォルダ
/// * `widgets_root`, `miniapps_root` - 取り込み先(widgets / miniapps)
///
/// # 戻り値
/// * `Ok(Some(..))` - 取り込めた
/// * `Ok(None)` - ミニアプリでもウィジェットでもない(または、すでに取り込み先の中にあるもの)
/// * `Err(理由)` - コピーなどに失敗した
pub fn install_dir(
    src: &Path,
    widgets_root: &Path,
    miniapps_root: &Path,
) -> Result<Option<Installed>, String> {
    if !src.is_dir() {
        return Ok(None);
    }
    let (kind, root, manifest) = if let Some(m) = read_manifest(src, "miniapp.json") {
        let ok = !clean_url(&m.url).is_empty()
            || entry_ok(
                src,
                if m.entry.is_empty() {
                    "index.html"
                } else {
                    &m.entry
                },
            );
        if !ok {
            return Ok(None);
        }
        ("miniapp", miniapps_root, m)
    } else if let Some(m) = read_manifest(src, "widget.json") {
        if !entry_ok(
            src,
            if m.entry.is_empty() {
                "index.html"
            } else {
                &m.entry
            },
        ) {
            return Ok(None);
        }
        ("widget", widgets_root, m)
    } else {
        return Ok(None);
    };
    let id = install_id(src);
    let dst = root.join(&id);
    // すでに取り込み先の中にあるフォルダ(自分自身)を、もう一度コピーしない
    if let (Ok(a), Ok(b)) = (fs::canonicalize(src), fs::canonicalize(&dst)) {
        if a == b {
            return Ok(None);
        }
    }
    fs::create_dir_all(root).map_err(|e| e.to_string())?;
    let tmp = root.join(format!(".tmp-{id}"));
    let _ = fs::remove_dir_all(&tmp);
    let (mut files, mut bytes) = (0usize, 0u64);
    if let Err(e) = copy_limited(src, &tmp, 0, &mut files, &mut bytes) {
        let _ = fs::remove_dir_all(&tmp);
        return Err(e);
    }
    // 置き換え: 古いものは、いったん脇へ移して、新しいものが置けてから消す(失敗したら元に戻す)
    let old = root.join(format!(".old-{id}"));
    let _ = fs::remove_dir_all(&old);
    let had_old = dst.exists() && fs::rename(&dst, &old).is_ok();
    if let Err(e) = fs::rename(&tmp, &dst) {
        if had_old {
            let _ = fs::rename(&old, &dst);
        }
        let _ = fs::remove_dir_all(&tmp);
        return Err(e.to_string());
    }
    let _ = fs::remove_dir_all(&old);
    let name = if manifest.name.trim().is_empty() {
        id.clone()
    } else {
        manifest.name.chars().take(40).collect()
    };
    Ok(Some(Installed {
        kind: kind.into(),
        id,
        name,
    }))
}
