//! `widget://` と `miniapp://` のプロトコル。画面の `<iframe>` が読むファイルを、渡す。
//!
//! `miniapp://` は、ミニアプリのフォルダのファイルに加えて、画像ビューアが登録した画像(`/__img/<印>`)と見本(`/__thumb/<印>`)、
//! 音楽プレーヤーが登録した音声(`/__music/<印>`)も渡す。登録された印のファイルだけを渡し、任意のパスは渡さない。

use crate::extensions::appdata;
use crate::extensions::catalog::miniapps_dir;
use crate::extensions::catalog::widgets_dir;
use crate::extensions::music;
use crate::extensions::widgets;
#[cfg(windows)]
use crate::platform::icon;
use crate::state::AppState;
use crate::state::LockExt;
use std::fs;
use std::path::Path;
use std::path::PathBuf;
use std::sync::atomic::AtomicUsize;
use std::sync::atomic::Ordering;
use tauri::http::Request;
use tauri::http::Response;
use tauri::Manager;
use tauri::UriSchemeContext;
use tauri::Wry;

/// 見つからないときの返事(404)。
fn not_found() -> Response<Vec<u8>> {
    Response::builder()
        .status(404)
        .body(Vec::new())
        .unwrap_or_default()
}

/// 外部との通信を、利用者が許可したものの一覧(設定の `networkAllowed`)。ページの CSP の `connect-src` を決めるのに使う。
fn network_allowed(ctx: &UriSchemeContext<'_, Wry>) -> Vec<String> {
    ctx.app_handle()
        .state::<AppState>()
        .config
        .lock_ok()
        .settings
        .network_allowed
        .clone()
}

/// 登録された印(トークン)に結びついたファイルのパス(無ければ `None`)。
fn registered_path(ctx: &UriSchemeContext<'_, Wry>, token: &str) -> Option<PathBuf> {
    ctx.app_handle()
        .state::<AppState>()
        .music
        .lock_ok()
        .get(token)
}

/// 追加ウィジェットのファイルを渡す(`widgets` フォルダの中だけ)。
pub(crate) fn widget(
    ctx: UriSchemeContext<'_, Wry>,
    request: Request<Vec<u8>>,
) -> Response<Vec<u8>> {
    match widgets_dir(ctx.app_handle()) {
        Some(root) => widgets::respond(
            &root,
            "widget.localhost",
            request.uri().path(),
            &network_allowed(&ctx),
        ),
        None => not_found(),
    }
}

/// ミニアプリのファイルを渡す(`miniapps` フォルダの中だけ)。画像・見本・音声の、登録された印も扱う。
pub(crate) fn miniapp(
    ctx: UriSchemeContext<'_, Wry>,
    request: Request<Vec<u8>>,
) -> Response<Vec<u8>> {
    // 画像ビューアが登録した画像(/__img/<印>)と、その小さな見本(/__thumb/<印>)
    let uri_path = request.uri().path();
    if let Some(token) = uri_path
        .strip_prefix("/__img/")
        .or_else(|| uri_path.strip_prefix("/__thumb/"))
    {
        return match registered_path(&ctx, token) {
            Some(p) if uri_path.starts_with("/__thumb/") => thumbnail(&ctx, &p),
            Some(p) => music::serve_image(&p),
            None => not_found(),
        };
    }
    // 音楽プレーヤーが登録した音声ファイル(/__music/<印>)
    if let Some(token) = uri_path.strip_prefix("/__music/") {
        return match registered_path(&ctx, token) {
            Some(p) => music::serve(
                &p,
                request.headers().get("range").and_then(|v| v.to_str().ok()),
            ),
            None => not_found(),
        };
    }
    match miniapps_dir(ctx.app_handle()) {
        Some(root) => widgets::respond(
            &root,
            "miniapp.localhost",
            request.uri().path(),
            &network_allowed(&ctx),
        ),
        None => not_found(),
    }
}

/// 画像の小さな見本を返す。見本は、画像ビューアの cache フォルダ(`miniapps\gallery\cache\thumbs`)に残して、2 回目からは、それを返す。
/// 残した見本が、上限(`THUMB_CACHE_MAX`)を超えないよう、100 枚書くたびに、古いものから消す。
fn thumbnail(ctx: &UriSchemeContext<'_, Wry>, p: &Path) -> Response<Vec<u8>> {
    let gallery = miniapps_dir(ctx.app_handle())
        .map(|r| r.join("gallery"))
        .filter(|g| g.is_dir());
    let cache_dir = gallery.map(|g| g.join("cache").join("thumbs"));
    let key = appdata::thumb_key(p);
    let file = cache_dir
        .as_ref()
        .zip(key.as_ref())
        .map(|(d, k)| d.join(format!("{k}.png")));
    if let Some(Ok(bytes)) = file.as_ref().map(fs::read) {
        return music::serve_thumb(Some(bytes));
    }
    #[cfg(windows)]
    let png = icon::thumbnail_png(&p.to_string_lossy());
    #[cfg(not(windows))]
    let png: Option<Vec<u8>> = None;
    if let (Some(f), Some(b), Some(d)) = (file.as_ref(), png.as_ref(), cache_dir.as_ref()) {
        static WRITES: AtomicUsize = AtomicUsize::new(0);
        if fs::create_dir_all(d).is_ok()
            && fs::write(f, b).is_ok()
            && WRITES.fetch_add(1, Ordering::Relaxed) % 100 == 99
        {
            appdata::prune(d, appdata::THUMB_CACHE_MAX);
        }
    }
    music::serve_thumb(png)
}
