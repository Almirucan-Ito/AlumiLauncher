//! Web ミニアプリ(URL を開くもの)の別ウィンドウ。位置合わせ・音量・閉じる。

use crate::extensions::catalog::miniapps_dir;
use crate::extensions::widgets;
use crate::state::AppState;
use crate::state::LockExt;
use crate::window::visibility::disable_round_corners;
use std::sync::Mutex;
use std::time::Duration;
use tauri::AppHandle;
use tauri::Manager;

/// Web ミニアプリのウィンドウのラベル(同時に開けるのは 1 つだけ)。
pub(crate) const MINI_WEB_LABEL: &str = "miniweb";

/// Web ミニアプリのページの音量を、ランチャーの音量に合わせる JavaScript を作る。
/// ページが音量を決める(`volume` への代入)たびに、ランチャーの音量を掛ける。見かけの音量(`volume` の値)は、ページが決めたまま。
///
/// # 引数
/// * `percent` - ランチャーの音量(0〜100)
///
/// # 戻り値
/// ページへ注入するスクリプト(`window.__alumiSetVol(p)` で、あとから音量を変えられる)
pub(crate) fn mini_web_volume_script(percent: u32) -> String {
    format!(
        r#"(function(){{
  if (window.__alumiSetVol) return;
  var master = {percent} / 100;
  var proto = HTMLMediaElement.prototype;
  var d = Object.getOwnPropertyDescriptor(proto, 'volume');
  if (!d || !d.set) return;
  var want = new WeakMap();
  var wanted = function (el) {{ return want.has(el) ? want.get(el) : 1; }};
  Object.defineProperty(proto, 'volume', {{ configurable: true,
    get: function () {{ return wanted(this); }},
    set: function (v) {{ want.set(this, v); d.set.call(this, Math.max(0, Math.min(1, v * master))); }} }});
  var apply = function (el) {{ d.set.call(el, Math.max(0, Math.min(1, wanted(el) * master))); }};
  ['play', 'loadedmetadata'].forEach(function (ev) {{
    document.addEventListener(ev, function (e) {{ if (e.target instanceof HTMLMediaElement) apply(e.target); }}, true);
  }});
  window.__alumiSetVol = function (p) {{
    master = p / 100;
    document.querySelectorAll('video,audio').forEach(apply);
  }};
}})();"#
    )
}

/// ミニアプリの上のバー(「‹ ホーム」)の高さ。styles.css の .mini-bar と同じ(論理ピクセル)
pub(crate) const MINI_BAR_HEIGHT: f64 = 40.0;

/// Web ミニアプリのウィンドウの、左・右・下に残す余白(論理ピクセル)。ランチャーの端をドラッグして大きさを変えられるように
pub(crate) const MINI_EDGE: f64 = 8.0;

/// スマホのブラウザとして名乗る(miniapp.json で "mobile": true にした Web ミニアプリだけ)
pub(crate) const MOBILE_USER_AGENT: &str =
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

/// Esc で閉じるために、Web ミニアプリのページへ入れる小さなスクリプト。
/// ページからランチャーの機能は呼べないので、Esc が押されたら、合図の住所(alumi-close.invalid)へ移動しようとする。
/// 移動はバックエンドが止めて、代わりにウィンドウを閉じる。全画面表示中・入力中の Esc は、ページに任せる
const MINI_WEB_ESC_SCRIPT: &str = r#"(function(){
  if (window.top !== window) return;
  window.addEventListener('keydown', function(e){
    if (e.key !== 'Escape' || e.defaultPrevented || document.fullscreenElement) return;
    var t = document.activeElement;
    if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
    location.href = 'https://alumi-close.invalid/';
  });
})();"#;

/// ページを「いつも表示中・操作中」に見せるスクリプト。
/// ランチャーの大きさを変える・動かすと、Web ミニアプリのウィンドウが一時的に非表示・フォーカス外と判断され、
/// 動画サイトなどが `visibilitychange` / `blur` で再生を止めてしまい、その後も止まりやすくなるため、その通知をページへ届けない。
const MINI_WEB_VISIBLE_SCRIPT: &str = r#"(function(){
  if (window.top !== window || window.__alumiVisible) return;
  window.__alumiVisible = true;
  var def = function (o, k, v) { try { Object.defineProperty(o, k, { configurable: true, get: v }); } catch (e) {} };
  def(Document.prototype, 'hidden', function () { return false; });
  def(Document.prototype, 'visibilityState', function () { return 'visible'; });
  def(Document.prototype, 'webkitHidden', function () { return false; });
  def(Document.prototype, 'webkitVisibilityState', function () { return 'visible'; });
  try { document.hasFocus = function () { return true; }; } catch (e) {}
  var stop = function (e) { e.stopImmediatePropagation(); };
  ['visibilitychange', 'webkitvisibilitychange', 'pagehide', 'freeze'].forEach(function (n) {
    window.addEventListener(n, stop, true);
    document.addEventListener(n, stop, true);
  });
  window.addEventListener('blur', function (e) { if (e.target === window) e.stopImmediatePropagation(); }, true);
})();"#;

/// Web ミニアプリのウィンドウを、ランチャーの画面(上のバーの下)に重ねる位置・大きさを求める(`fit_mini_web` が使えないときの代わり)。
///
/// # 引数
/// * `main` - ランチャーのウィンドウ
///
/// # 戻り値
/// (位置, 大きさ)(物理ピクセル)。取得できなければ `None`
fn mini_web_bounds(
    main: &tauri::WebviewWindow,
) -> Option<(tauri::PhysicalPosition<i32>, tauri::PhysicalSize<u32>)> {
    let pos = main.inner_position().ok()?;
    let size = main.inner_size().ok()?;
    let scale = main.scale_factor().ok()?;
    let bar = (MINI_BAR_HEIGHT * scale).round() as u32;
    Some((
        tauri::PhysicalPosition::new(pos.x, pos.y + bar as i32),
        tauri::PhysicalSize::new(size.width.max(1), size.height.saturating_sub(bar).max(1)),
    ))
}

/// ウィンドウが実際に見えている範囲(Windows が付ける影や、見えない枠を除いた矩形)を求める。
///
/// # 引数
/// * `w` - ウィンドウ
///
/// # 戻り値
/// 画面のピクセルでの矩形。取得できなければ `None`
#[cfg(windows)]
pub(crate) fn visible_rect(w: &tauri::WebviewWindow) -> Option<windows::Win32::Foundation::RECT> {
    use windows::Win32::Foundation::{HWND, RECT};
    use windows::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_EXTENDED_FRAME_BOUNDS};
    let hwnd = HWND(w.hwnd().ok()?.0 as _);
    let mut r = RECT::default();
    // SAFETY: `hwnd` は、渡されたウィンドウ自身のハンドル。`r` は、この関数の中の変数で、渡す大きさは `RECT` の大きさ。
    unsafe {
        DwmGetWindowAttribute(
            hwnd,
            DWMWA_EXTENDED_FRAME_BOUNDS,
            &mut r as *mut RECT as *mut std::ffi::c_void,
            std::mem::size_of::<RECT>() as u32,
        )
        .ok()?;
    }
    Some(r)
}

/// Web ミニアプリのウィンドウを、ランチャーの「見えている範囲」の、上のバーの下にぴったり重ねる。
/// ウィンドウの外枠には見えない枠の分があるので、見える範囲と外枠の差を測って補正する。
/// 位置と大きさは、`SetWindowPos` 1 回で直接変える(ランチャーをドラッグで動かしている最中も、遅れずに付いてこられるように)。
///
/// # 引数
/// * `w` - Web ミニアプリのウィンドウ
/// * `main` - ランチャーのウィンドウ
///
/// # 戻り値
/// 合わせられたら `Some(())`
#[cfg(windows)]
pub(crate) fn fit_mini_web(w: &tauri::WebviewWindow, main: &tauri::WebviewWindow) -> Option<()> {
    use windows::Win32::Foundation::{HWND, RECT};
    use windows::Win32::UI::WindowsAndMessaging::{
        GetWindowRect, SetWindowPos, SWP_NOACTIVATE, SWP_NOZORDER,
    };
    let mv = visible_rect(main)?;
    let bar = (MINI_BAR_HEIGHT * main.scale_factor().ok()?).round() as i32;
    // 左・右・下に少し余白を残して、ランチャーの端(大きさを変えるつかみ代)が、Web の画面に隠れないようにする
    let edge = (MINI_EDGE * main.scale_factor().ok()?).round() as i32;
    let (tx, ty) = (mv.left + edge, mv.top + bar);
    let (tw, th) = (
        (mv.right - mv.left - 2 * edge).max(1),
        (mv.bottom - mv.top - bar - edge).max(1),
    );
    let hw = HWND(w.hwnd().ok()?.0 as _);
    let wv = visible_rect(w)?;
    let mut wr = RECT::default();
    // SAFETY: `hw` は、渡されたウィンドウ自身のハンドル。`wr` は、この関数の中の変数。
    unsafe { GetWindowRect(hw, &mut wr).ok()? };
    let (l, t, r, b) = (
        wv.left - wr.left,
        wv.top - wr.top,
        wr.right - wv.right,
        wr.bottom - wv.bottom,
    );
    // SAFETY: `hw` は、渡されたウィンドウ自身のハンドル。位置と大きさだけを変える(重なり順・フォーカスは変えない)。
    unsafe {
        SetWindowPos(
            hw,
            HWND::default(),
            tx - l,
            ty - t,
            tw + l + r,
            th + t + b,
            SWP_NOZORDER | SWP_NOACTIVATE,
        )
        .ok()?
    };
    Some(())
}

/// ランチャーの位置・大きさが変わったとき、開いている Web ミニアプリのウィンドウも合わせる。
///
/// # 引数
/// * `app` - アプリのハンドル
pub(crate) fn sync_mini_web(app: &AppHandle) {
    let (Some(w), Some(main)) = (
        app.get_webview_window(MINI_WEB_LABEL),
        app.get_webview_window("main"),
    ) else {
        return;
    };
    #[cfg(windows)]
    if fit_mini_web(&w, &main).is_some() {
        return;
    }
    if let Some((pos, size)) = mini_web_bounds(&main) {
        let _ = w.set_position(pos);
        let _ = w.set_size(size);
    }
}

/// (コマンド)Web ミニアプリ(`miniapp.json` の `url`)を、別のウィンドウで開く。ランチャーの画面(上のバーの下)にぴったり重ね、ランチャーの位置や大きさが変わると合わせる。枠は出さない。
/// 外部のサイトと通信するので、利用者が同意していないものは、開かない(`"not_allowed"`)。https 以外へは移動させない。
/// 閉じるのは、ランチャーの「ホーム」「閉じる」・Esc。閉じると、画面側へ知らせる(`miniweb-closed`)。このウィンドウには、ランチャーの機能(IPC)の権限を与えない。
///
/// # 引数
/// * `id` - Web ミニアプリのフォルダ名
///
/// # 戻り値
/// `Ok(())`。見つからない・同意がない・ウィンドウを作れないときは、エラーの理由
#[tauri::command]
pub async fn mini_web_open(app: AppHandle, id: String) -> Result<(), String> {
    use tauri::{Emitter, WebviewUrl, WebviewWindowBuilder};
    let root = miniapps_dir(&app).ok_or_else(|| "no app data dir".to_string())?;
    let info = widgets::scan_miniapps(&root)
        .into_iter()
        .find(|a| a.id == id)
        .filter(|a| !a.url.is_empty())
        .ok_or_else(|| "not_found".to_string())?;
    let parsed = tauri::Url::parse(&info.url).map_err(|e| e.to_string())?;
    // 外部のサイトを開く(通信する)ので、利用者の同意がないものは、開かない
    if !app
        .state::<AppState>()
        .config
        .lock_ok()
        .settings
        .network_allowed
        .contains(&format!("miniapp:{}", info.id))
    {
        return Err("not_allowed".into());
    }
    let main = app
        .get_webview_window("main")
        .ok_or_else(|| "no main window".to_string())?;
    if let Some(old) = app.get_webview_window(MINI_WEB_LABEL) {
        let _ = old.destroy();
    }
    let nav_app = app.clone();
    let volume = app
        .state::<AppState>()
        .config
        .lock_ok()
        .settings
        .master_volume;
    let mut builder = WebviewWindowBuilder::new(&app, MINI_WEB_LABEL, WebviewUrl::External(parsed))
        .title(info.name.as_str())
        // アプリ本体とは別の保存場所(プロファイル)を使う。同じ場所を別の設定で開くと WebView2 が 0x8007139F で失敗するため。
        // ブラウザの保存データ(Cookie など)は、ここにだけ残り、ランチャーの画面とは混ざらない
        // ミニアプリのフォルダの中(miniapps\<名前>\data\webview)に保存する。データの消去で消え、キャッシュの消去では Cookie などは残る
        .data_directory(root.join(&info.id).join("data").join("webview"))
        .decorations(false)
        .resizable(false)
        .skip_taskbar(true)
        // 最初の読み込みが終わって、位置が合うまでは出さない(左上に、白い画面が一瞬映らないように)
        .visible(false)
        .focused(false)
        .on_page_load(|win, payload| {
            if let tauri::webview::PageLoadEvent::Finished = payload.event() {
                sync_mini_web(win.app_handle());
                if !win.is_visible().unwrap_or(false) {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
        })
        .initialization_script(MINI_WEB_ESC_SCRIPT)
        .initialization_script(MINI_WEB_VISIBLE_SCRIPT)
        .initialization_script(mini_web_volume_script(volume))
        .on_navigation(move |u| {
            if u.host_str() == Some("alumi-close.invalid") {
                // Esc の合図: 移動は止めて、ウィンドウを閉じる(ナビゲーションの最中に閉じないよう、別のタスクで)
                let h = nav_app.clone();
                tauri::async_runtime::spawn(async move {
                    if let Some(w) = h.get_webview_window(MINI_WEB_LABEL) {
                        let _ = w.destroy();
                    }
                });
                return false;
            }
            // https 以外(file: や tauri: など)へは移動させない
            u.scheme() == "https"
        });
    // 既定はパソコンとして開く。miniapp.json で "mobile": true にしたときだけ、スマホとして名乗る
    if info.mobile {
        builder = builder.user_agent(MOBILE_USER_AGENT);
    }
    // ランチャーの持ち物(owner)にして、ランチャーより必ず前に出し、ほかのアプリより前には出ないようにする
    builder = builder.parent(&main).map_err(|e| e.to_string())?;
    *MINI_WEB_ID.lock_ok() = info.id.clone();
    // ポータブル版は、起動時に WEBVIEW2_USER_DATA_FOLDER を設定している。この環境変数は、ウィンドウごとの保存場所の指定より優先されるので、
    // 別の保存場所を使うこのウィンドウを作る前に外す(外さないと、本体と同じ場所を別の設定で開くことになり、0x8007139F で失敗する)。
    // 本体の画面は、起動時にすでに作られているので、影響しない
    std::env::remove_var("WEBVIEW2_USER_DATA_FOLDER");
    let window = builder.build().map_err(|e| format!("window: {e}"))?;
    #[cfg(windows)]
    disable_round_corners(&window); // ランチャーと同じく、OS の角丸・枠線を消す(ぴったり重ねるため)
    sync_mini_web(&app);
    // 読み込みが終わらなくても、数秒後には出す
    let late = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(4));
        if let Some(w) = late.get_webview_window(MINI_WEB_LABEL) {
            if !w.is_visible().unwrap_or(true) {
                sync_mini_web(&late);
                let _ = w.show();
                let _ = w.set_focus();
            }
        }
    });
    let handle = app.clone();
    window.on_window_event(move |e| {
        if let tauri::WindowEvent::Destroyed = e {
            MINI_WEB_ID.lock_ok().clear();
            let _ = handle.emit("miniweb-closed", ());
        }
    });
    Ok(())
}

/// (コマンド)開いている Web ミニアプリのウィンドウを閉じる。
#[tauri::command]
pub async fn mini_web_close(app: AppHandle) {
    if let Some(w) = app.get_webview_window(MINI_WEB_LABEL) {
        let _ = w.destroy();
    }
}

/// いま開いている Web ミニアプリのフォルダ名(開いている間は、その保存場所は消せない)。
pub(crate) static MINI_WEB_ID: Mutex<String> = Mutex::new(String::new());

/// Web ミニアプリが、開いていて使用中か調べる(使用中のデータ・キャッシュは消せない)。
///
/// # 引数
/// * `kind` - `"widget"` か `"miniapp"`
/// * `id` - フォルダ名
///
/// # 戻り値
/// 開いている Web ミニアプリ自身なら `true`
pub(crate) fn web_in_use(app: &AppHandle, kind: &str, id: &str) -> bool {
    kind == "miniapp"
        && app.get_webview_window(MINI_WEB_LABEL).is_some()
        && MINI_WEB_ID.lock_ok().as_str() == id
}

/// (コマンド)開いている Web ミニアプリの音量を、ランチャーの音量に合わせる。
///
/// # 引数
/// * `percent` - 音量(0〜100)
#[tauri::command]
pub async fn mini_web_volume(app: AppHandle, percent: u32) {
    if let Some(w) = app.get_webview_window(MINI_WEB_LABEL) {
        let _ = w.eval(format!(
            "window.__alumiSetVol&&window.__alumiSetVol({})",
            percent.min(100)
        ));
    }
}
