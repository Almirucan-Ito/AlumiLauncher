//! `widget://` / `miniapp://` のリクエストへの応答(ファイルの配信・CSP・外部通信の許可)。

use super::*;

/// ファイルの拡張子から、`Content-Type` を決める。
///
/// # 引数
/// * `path` - ファイルのパス
///
/// # 戻り値
/// MIME タイプ。知らない拡張子は `application/octet-stream`
pub fn mime(path: &Path) -> &'static str {
    match path
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .as_deref()
    {
        Some("html" | "htm") => "text/html; charset=utf-8",
        Some("js" | "mjs") => "text/javascript; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("json") => "application/json; charset=utf-8",
        Some("svg") => "image/svg+xml",
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("woff2") => "font/woff2",
        Some("woff") => "font/woff",
        Some("ttf") => "font/ttf",
        Some("txt") => "text/plain; charset=utf-8",
        _ => "application/octet-stream",
    }
}

/// ウィジェット・ミニアプリのページに付ける CSP(Content-Security-Policy)を作る。
/// 自分のフォルダのファイルとインラインだけを許し、ランチャーの画面(親)やローカルのファイルには、sandbox のため触れない。
/// 外部(https など)との通信は、`net` が `true` のとき(宣言していて、利用者が同意したもの)だけ許す。
///
/// # 引数
/// * `host` - 自分のホスト名(`widget.localhost` など)。自分のファイルを許すために、CSP に入れる
/// * `net` - 外部との通信を許すか
///
/// # 戻り値
/// CSP のヘッダーの値
pub(crate) fn csp(host: &str, net: bool) -> String {
    let own = format!("http://{host} https://{host}");
    if net {
        format!(
            "default-src 'none'; script-src 'unsafe-inline' {own} https:; style-src 'unsafe-inline' {own} https:; \
img-src data: blob: {own} https: http:; font-src data: {own} https:; media-src data: blob: {own} https:; \
connect-src https: http: wss: ws:; frame-src 'none'; form-action 'none'; base-uri 'none'"
        )
    } else {
        format!(
            "default-src 'none'; script-src 'unsafe-inline' {own}; style-src 'unsafe-inline' {own}; \
img-src data: blob: {own}; font-src data: {own}; media-src data: blob: {own}; \
connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'"
        )
    }
}

/// 同意の記録のキーと、通信を宣言しているマニフェストの場所を求める。
/// キーは、ウィジェットが `widget:<名前>`、ミニアプリが `miniapp:<名前>`、ミニアプリの中のウィジェットが `widget:<ミニアプリ>/<名前>`。
///
/// # 引数
/// * `host` - リクエストのホスト名(`miniapp` で始まればミニアプリのプロトコル)
/// * `root` - プロトコルが公開しているフォルダ(widgets または miniapps)
/// * `id` - 最初のフォルダ名
/// * `file` - その下のファイルの相対パス(`widgets/<名前>/...` ならミニアプリの中のウィジェット)
///
/// # 戻り値
/// (同意のキー, マニフェストのパス)
pub fn consent_key(host: &str, root: &Path, id: &str, file: &str) -> (String, PathBuf) {
    let mini = host.starts_with("miniapp");
    let mut parts = file.split('/');
    if mini && parts.next() == Some("widgets") {
        if let Some(w) = parts.next().filter(|w| valid_id(w)) {
            return (
                format!("widget:{id}/{w}"),
                root.join(id).join("widgets").join(w).join("widget.json"),
            );
        }
    }
    (
        format!("{}:{id}", if mini { "miniapp" } else { "widget" }),
        root.join(id)
            .join(if mini { "miniapp.json" } else { "widget.json" }),
    )
}

/// 外部との通信を許してよいかを調べる。マニフェストで `"network": true` と宣言していて、かつ、利用者が同意している(`allowed` にキーがある)ときだけ許す。
///
/// # 引数
/// * `host`, `root`, `id`, `file` - `consent_key` と同じ
/// * `allowed` - 利用者が同意したものの一覧(設定の `networkAllowed`)
///
/// # 戻り値
/// 通信してよければ `true`
pub(crate) fn network_ok(
    host: &str,
    root: &Path,
    id: &str,
    file: &str,
    allowed: &[String],
) -> bool {
    let (key, manifest) = consent_key(host, root, id, file);
    allowed.contains(&key)
        && fs::read_to_string(manifest)
            .ok()
            .and_then(|t| serde_json::from_str::<Manifest>(t.trim_start_matches('\u{feff}')).ok())
            .map(|m| m.network)
            .unwrap_or(false)
}

/// `widget` / `miniapp` プロトコルへのリクエストに答える。パスは `/<id>/<ファイル>`。
/// フォルダの外へ出るパス(`..`、リンク、巨大なファイル)には、404 を返す。CSP は `csp` で作る(通信は、`network_ok` のときだけ許す)。
///
/// # 引数
/// * `root` - 公開するフォルダ(widgets または miniapps)
/// * `host` - 自分のホスト名(CSP に入れる)
/// * `uri_path` - リクエストのパス
/// * `allowed` - 通信に同意したものの一覧
///
/// # 戻り値
/// HTTP の応答(200 ならファイルの中身、見つからなければ 404)
pub fn respond(
    root: &Path,
    host: &str,
    uri_path: &str,
    allowed: &[String],
) -> tauri::http::Response<Vec<u8>> {
    let rel_for_net = uri_path.trim_start_matches('/');
    let net = rel_for_net
        .split_once('/')
        .map(|(id, file)| valid_id(id) && network_ok(host, root, id, file, allowed))
        .unwrap_or(false);
    let policy = csp(host, net);
    let build = |status: u16, ctype: &str, body: Vec<u8>| {
        tauri::http::Response::builder()
            .status(status)
            .header("Content-Type", ctype)
            .header("Content-Security-Policy", policy.as_str())
            .header("Access-Control-Allow-Origin", "*")
            .header("X-Content-Type-Options", "nosniff")
            .header("Cache-Control", "no-cache")
            .body(body)
            .unwrap_or_default()
    };
    let rel = uri_path.trim_start_matches('/');
    let Some((id, file)) = rel.split_once('/') else {
        return build(404, "text/plain", Vec::new());
    };
    if !valid_id(id) {
        return build(404, "text/plain", Vec::new());
    }
    let Some(path) = safe_join(&root.join(id), file) else {
        return build(404, "text/plain", Vec::new());
    };
    // シンボリックリンク等で外に出ていないかも確認する
    let inside = match (fs::canonicalize(&path), fs::canonicalize(root.join(id))) {
        (Ok(p), Ok(b)) => p.starts_with(b),
        _ => false,
    };
    if !inside
        || fs::metadata(&path)
            .map(|m| !m.is_file() || m.len() > MAX_FILE)
            .unwrap_or(true)
    {
        return build(404, "text/plain", Vec::new());
    }
    match fs::read(&path) {
        Ok(bytes) => build(200, mime(&path), bytes),
        Err(_) => build(404, "text/plain", Vec::new()),
    }
}
