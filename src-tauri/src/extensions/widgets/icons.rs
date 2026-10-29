//! ミニアプリのアイコンの読み込み(画面へ渡す data URI)。

use super::*;

/// ミニアプリのアイコン画像(フォルダ内の実在する画像。1MB まで)を、data URI にして返す。
///
/// # 引数
/// * `root` - miniapps フォルダ
/// * `id` - ミニアプリのフォルダ名
///
/// # 戻り値
/// `data:<MIME>;base64,...`。画像が無い・大きすぎる・読めないときは `None`
pub fn icon_data_uri(root: &Path, id: &str) -> Option<String> {
    use base64::Engine;
    if !valid_id(id) {
        return None;
    }
    let dir = root.join(id);
    let m = read_manifest(&dir, "miniapp.json")?;
    let icon = clean_icon(&dir, &m.icon);
    if icon.is_empty() {
        return None;
    }
    let path = safe_join(&dir, &icon)?;
    if fs::metadata(&path).ok()?.len() > 1024 * 1024 {
        return None;
    }
    let bytes = fs::read(&path).ok()?;
    let ctype = mime(&path);
    Some(format!(
        "data:{ctype};base64,{}",
        base64::engine::general_purpose::STANDARD.encode(bytes)
    ))
}

/// 画像のないミニアプリに使う、標準のアイコン(フラットデザイン)を data URI で返す。
///
/// # 戻り値
/// SVG の data URI
pub fn default_miniapp_icon() -> String {
    use base64::Engine;
    let svg = r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#565ae8"/><rect x="15" y="15" width="17" height="17" rx="4" fill="#fff"/><rect x="37" y="15" width="17" height="17" rx="4" fill="#fff" opacity=".7"/><rect x="15" y="37" width="17" height="17" rx="4" fill="#fff" opacity=".7"/><rect x="37" y="37" width="17" height="17" rx="4" fill="#fff" opacity=".4"/></svg>"##;
    format!(
        "data:image/svg+xml;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(svg)
    )
}
