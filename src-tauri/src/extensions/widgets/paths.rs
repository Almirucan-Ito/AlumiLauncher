//! 名前・URL・パスの検査(フォルダの外へ出ないか・使える名前か)。

use super::*;

/// Web ミニアプリの URL として使えるかを調べる(https で始まり、500 字以下で、空白・制御文字を含まない)。
///
/// # 引数
/// * `u` - マニフェストに書かれた URL
///
/// # 戻り値
/// 使えるなら、そのままの URL。使えなければ空文字
pub fn clean_url(u: &str) -> String {
    let ok = u.starts_with("https://")
        && u.len() <= 500
        && u.len() > 12
        && !u.chars().any(|c| c.is_whitespace() || c.is_control());
    if ok {
        u.to_string()
    } else {
        String::new()
    }
}

/// フォルダ名(ウィジェット・ミニアプリの ID)として使えるか調べる。パスの区切りや先頭のドットを含むものは、不可(フォルダの外を指せないようにするため)。
///
/// # 引数
/// * `id` - 調べる名前
///
/// # 戻り値
/// 英数字・`-`・`_`・`.` だけで、64 字以下の、空でない名前なら `true`
pub fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && !id.starts_with('.')
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
}

/// `base` の下のファイルだけを指す、安全なパスを作る。`..` や絶対パス・ドライブ指定を含むと、拒否する。
///
/// # 引数
/// * `base` - 基準のフォルダ
/// * `rel` - `base` からの相対パス(`/` 区切り)
///
/// # 戻り値
/// `base` の下を指すパス。不正(または空)なら `None`
pub(crate) fn safe_join(base: &Path, rel: &str) -> Option<PathBuf> {
    let mut out = base.to_path_buf();
    let mut any = false;
    for c in Path::new(rel).components() {
        match c {
            Component::Normal(p) => {
                out.push(p);
                any = true;
            }
            _ => return None,
        }
    }
    any.then_some(out)
}
