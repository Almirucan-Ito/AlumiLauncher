//! ウィンドウの表示・非表示・終了・最前面・メモリの節約・角丸の無効化。

use crate::config::store::flush_config;
use crate::extensions::mini_web::MINI_WEB_LABEL;
use crate::files::roots::refresh_roots;
use crate::state::AppState;
use crate::window::desktop_mode::DESKTOP_MODE;
use std::sync::atomic::Ordering;
use tauri::AppHandle;
use tauri::Manager;

/// (コマンド)タイマーの終了などで、ウィンドウを前に出す。
#[tauri::command]
pub async fn bring_to_front(app: AppHandle) {
    show_window(&app);
}

/// WebView2 のメモリ使用量の目標を、低く(または普通に)する。非表示中は低くして、メモリを節約する。
///
/// # 引数
/// * `w` - ランチャーのウィンドウ
/// * `low` - `true` で低く、`false` で普通
#[cfg(windows)]
pub(crate) fn set_low_memory(w: &tauri::WebviewWindow, low: bool) {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2_19, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW,
        COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL,
    };
    use windows_core::Interface; // webview2-com が使う windows-core のバージョンに合わせる
                                 // SAFETY: `wv` は、`with_webview` が、ウィンドウの画面の部品(WebView2)の、生きている間だけ渡すもの。ここで使い終わり、外へ持ち出さない。呼び出しは COM のメソッドだけで、失敗しても結果を捨てる。
    let _ = w.with_webview(move |wv| unsafe {
        if let Ok(core) = wv.controller().CoreWebView2() {
            if let Ok(core19) = core.cast::<ICoreWebView2_19>() {
                let level = if low {
                    COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW
                } else {
                    COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL
                };
                let _ = core19.SetMemoryUsageTargetLevel(level);
            }
        }
    });
}

/// WebView2 のブラウザ標準のショートカット(Alt+← 「戻る」、F5・Ctrl+R 「更新」、F1 のヘルプなど)を無効にする。残すと、Alt+←/→ などのキーが、アプリに届く前にブラウザに取られてしまう。
///
/// # 引数
/// * `w` - ランチャーのウィンドウ
#[cfg(windows)]
pub(crate) fn disable_browser_accelerators(w: &tauri::WebviewWindow) {
    use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings3;
    use windows_core::Interface;
    // SAFETY: 上と同じ(`wv` は、この呼び出しの間だけ有効な WebView2。COM のメソッドを呼ぶだけで、外へ持ち出さない)。
    let _ = w.with_webview(move |wv| unsafe {
        if let Ok(core) = wv.controller().CoreWebView2() {
            if let Ok(settings) = core.Settings() {
                if let Ok(s3) = settings.cast::<ICoreWebView2Settings3>() {
                    let _ = s3.SetAreBrowserAcceleratorKeysEnabled(false);
                }
            }
        }
    });
}

/// ランチャーを隠す(終了はしない)。設定を保存し、Web ミニアプリのウィンドウも閉じて、メモリ使用量の目標を下げる。
///
/// # 引数
/// * `app` - アプリのハンドル
pub(crate) fn hide_main(app: &AppHandle) {
    flush_config(app);
    // デスクトップモードでは、ランチャーを隠さない(常に表示したままにする)
    if DESKTOP_MODE.load(Ordering::SeqCst) {
        return;
    }
    // ランチャーを閉じる(隠す)ときは、Web ミニアプリのウィンドウも閉じる(閉じると、画面側へも知らせる)
    if let Some(mw) = app.get_webview_window(MINI_WEB_LABEL) {
        let _ = mw.destroy();
    }
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.hide();
        #[cfg(windows)]
        set_low_memory(&w, true);
    }
}

/// 画面の用意ができたことにする。出してほしいと言われていれば(`want_show`)、ここで出す。
///
/// # 引数
/// * `app` - アプリのハンドル
pub(crate) fn mark_ready(app: &AppHandle) {
    let st = app.state::<AppState>();
    st.ready.store(true, Ordering::SeqCst);
    if st.want_show.swap(false, Ordering::SeqCst) {
        show_window_now(app);
    }
}

/// (コマンド)画面(フロント)から: 起動時のアイコンの用意ができたと知らせる。それまで、起動時のウィンドウは出ない。
#[tauri::command]
pub async fn app_ready(app: AppHandle) {
    mark_ready(&app);
}

/// ウィンドウを出す。画面の用意ができていなければ、出す予約(`want_show`)だけして、用意ができたときに出す。
///
/// # 引数
/// * `app` - アプリのハンドル
pub(crate) fn show_window(app: &AppHandle) {
    let st = app.state::<AppState>();
    if !st.ready.load(Ordering::SeqCst) {
        st.want_show.store(true, Ordering::SeqCst); // 用意ができたら出す
        return;
    }
    show_window_now(app);
}

/// ウィンドウをいますぐ出して、最小化を戻し、フォーカスを当てる。見えるようになったフォルダに備えて、操作してよいフォルダの一覧も作り直す。
///
/// # 引数
/// * `app` - アプリのハンドル
pub(crate) fn show_window_now(app: &AppHandle) {
    refresh_roots(app); // 接続されていなかったドライブのフォルダが使えるようになっている場合に備える
    if let Some(w) = app.get_webview_window("main") {
        // 表示中も、メモリ使用量の目標は「低」のまま(キャッシュなどを早めに手放す)
        #[cfg(windows)]
        set_low_memory(&w, true);
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

/// ウィンドウの表示/非表示を切り替える。見えていて、フォーカスがある(Web ミニアプリにある場合も含む)ときは隠し、それ以外は出す。
///
/// # 引数
/// * `app` - アプリのハンドル
pub(crate) fn toggle_window(app: &AppHandle) {
    // デスクトップモードでは、隠さない(ショートカットやトレイのクリックは、操作できる状態にするだけ)
    if DESKTOP_MODE.load(Ordering::SeqCst) {
        show_window(app);
        return;
    }
    if let Some(w) = app.get_webview_window("main") {
        let web_focused = app
            .get_webview_window(MINI_WEB_LABEL)
            .map(|m| m.is_focused().unwrap_or(false))
            .unwrap_or(false);
        if w.is_visible().unwrap_or(false) && (w.is_focused().unwrap_or(false) || web_focused) {
            hide_main(app);
        } else {
            show_window(app);
        }
    }
}

/// 設定の「アプリを終了する」: 設定を保存して、バックグラウンドで動いているアプリも含めて、終了する
#[tauri::command]
pub async fn quit_app(app: AppHandle) {
    flush_config(&app);
    if let Some(mw) = app.get_webview_window(MINI_WEB_LABEL) {
        let _ = mw.destroy();
    }
    app.exit(0);
}

/// (コマンド)ランチャーを隠す(メモリ使用量を下げる処理は、Rust 側で行う)。
#[tauri::command]
pub async fn hide_window(app: AppHandle) {
    hide_main(&app);
}

/// (コマンド)常に最前面に表示するかを切り替える。
#[tauri::command]
pub async fn set_always_on_top(app: AppHandle, enabled: bool) {
    if let Some(w) = app.get_webview_window("main") {
        // デスクトップモード(常に一番後ろ)のあいだは、最前面にしない
        let _ = w.set_always_on_top(enabled && !DESKTOP_MODE.load(Ordering::SeqCst));
    }
}

/// Windows 11 の角丸と、OS が描く枠線を無効にする(角丸は CSS 側で描くため)。
///
/// # 引数
/// * `w` - 対象のウィンドウ
#[cfg(windows)]
pub(crate) fn disable_round_corners(w: &tauri::WebviewWindow) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::Graphics::Dwm::{
        DwmSetWindowAttribute, DWMWA_BORDER_COLOR, DWMWA_WINDOW_CORNER_PREFERENCE,
    };
    if let Ok(h) = w.hwnd() {
        let hwnd = HWND(h.0 as _);
        let pref: i32 = 1; // DWMWCP_DONOTROUND(角丸は CSS 側で描く)
        let no_border: u32 = 0xFFFF_FFFE; // DWMWA_COLOR_NONE(OS が描く枠線を消す)
                                          // SAFETY: `hwnd` は、このウィンドウ自身のハンドル。渡すポインタは、この関数の中の変数(`pref` / `no_border`)で、呼び出しの間、生きている。渡す大きさも、その型の大きさ。
        unsafe {
            let _ = DwmSetWindowAttribute(
                hwnd,
                DWMWA_WINDOW_CORNER_PREFERENCE,
                &pref as *const i32 as *const std::ffi::c_void,
                std::mem::size_of::<i32>() as u32,
            );
            let _ = DwmSetWindowAttribute(
                hwnd,
                DWMWA_BORDER_COLOR,
                &no_border as *const u32 as *const std::ffi::c_void,
                std::mem::size_of::<u32>() as u32,
            );
        }
    }
}
