//! デスクトップモード(常に一番後ろ・最大化して固定・最小化や移動を受け付けない)。

use crate::config::store::read_config;
use std::sync::atomic::AtomicBool;
use std::sync::atomic::Ordering;
use tauri::AppHandle;
use tauri::Manager;

/// デスクトップモードか(画面を隠さない・最小化しない・一番後ろに置く、の判断に使う)。
pub(crate) static DESKTOP_MODE: AtomicBool = AtomicBool::new(false);

/// デスクトップモードを入れる前に、ウィンドウが最大化していたか(切ったときに、その状態へ戻す)。
pub(crate) static WAS_MAXIMIZED: AtomicBool = AtomicBool::new(false);

/// デスクトップモードのウィンドウの手続き(サブクラス)。モードのあいだだけ働く。
/// ・どの操作でも、ウィンドウの重なり順を「一番後ろ」にする(クリックして操作できる状態でも、一番後ろのまま)
/// ・最小化・移動・大きさの変更・最大化の切り替え(タイトルバーの操作・ダブルクリック・ドラッグ)は受け付けない
///
/// # 引数
/// Windows のウィンドウの手続きと同じ(`hwnd` / `msg` / `wparam` / `lparam`)。
///
/// # Safety
/// `SetWindowSubclass` で取り付けたものとして、Windows だけが呼ぶ。`WM_WINDOWPOSCHANGING` のとき、`lparam` は、Windows が渡す、有効な `WINDOWPOS` を指す。
#[cfg(windows)]
pub(crate) unsafe extern "system" fn desktop_subclass_proc(
    hwnd: windows::Win32::Foundation::HWND,
    msg: u32,
    wparam: windows::Win32::Foundation::WPARAM,
    lparam: windows::Win32::Foundation::LPARAM,
    _id: usize,
    _data: usize,
) -> windows::Win32::Foundation::LRESULT {
    use windows::Win32::Foundation::LRESULT;
    use windows::Win32::UI::Shell::DefSubclassProc;
    use windows::Win32::UI::WindowsAndMessaging::{
        IsIconic, HTCAPTION, HWND_BOTTOM, SC_MAXIMIZE, SC_MINIMIZE, SC_MOVE, SC_RESTORE, SC_SIZE,
        SWP_NOZORDER, WINDOWPOS, WM_NCLBUTTONDBLCLK, WM_NCLBUTTONDOWN, WM_SYSCOMMAND,
        WM_WINDOWPOSCHANGING,
    };
    if DESKTOP_MODE.load(Ordering::SeqCst) {
        match msg {
            WM_WINDOWPOSCHANGING => {
                // SAFETY: `WM_WINDOWPOSCHANGING` のとき、`lparam` は、Windows が渡す、この呼び出しの間だけ有効な `WINDOWPOS` を指す(書き換えてよい)。
                let pos = &mut *(lparam.0 as *mut WINDOWPOS);
                pos.hwndInsertAfter = HWND_BOTTOM;
                pos.flags &= !SWP_NOZORDER;
            }
            WM_SYSCOMMAND => {
                let cmd = (wparam.0 & 0xFFF0) as u32;
                // 最小化から戻すとき(Win+D のあとなど)の SC_RESTORE だけは通す
                let restoring = cmd == SC_RESTORE && IsIconic(hwnd).as_bool();
                if !restoring
                    && matches!(
                        cmd,
                        SC_MINIMIZE | SC_MOVE | SC_SIZE | SC_MAXIMIZE | SC_RESTORE
                    )
                {
                    return LRESULT(0);
                }
            }
            WM_NCLBUTTONDOWN | WM_NCLBUTTONDBLCLK if wparam.0 as u32 == HTCAPTION => {
                return LRESULT(0); // タイトルバー相当の場所のドラッグ・ダブルクリックで、動かさない・戻さない
            }
            _ => {}
        }
    }
    DefSubclassProc(hwnd, msg, wparam, lparam)
}

/// デスクトップモードを、ウィンドウに反映する。入れるとき: 最前面をやめ、最大化して、一番後ろへ置く。切るとき: 最大化を戻し、最前面の設定を戻す。
/// ウィンドウの手続きの差し替えは、ウィンドウを作ったスレッドでしかできないので、画面のスレッドで行う。
///
/// # 引数
/// * `app` - アプリのハンドル
/// * `enabled` - 入れるなら `true`
pub(crate) fn apply_desktop_mode(app: &AppHandle, enabled: bool) {
    let was_on = DESKTOP_MODE.swap(enabled, Ordering::SeqCst);
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        let Some(w) = handle.get_webview_window("main") else {
            return;
        };
        if enabled {
            // 入れる前に最大化していたかを覚える(切ったときに、その状態へ戻すため)
            if !was_on {
                WAS_MAXIMIZED.store(w.is_maximized().unwrap_or(false), Ordering::SeqCst);
            }
            let _ = w.set_always_on_top(false);
            let _ = w.unminimize();
            let _ = w.maximize();
            #[cfg(windows)]
            install_desktop_subclass(&w);
        } else {
            // 入れる前が最大化なら、そのまま最大化。そうでなければ、元の大きさへ
            if !WAS_MAXIMIZED.load(Ordering::SeqCst) {
                let _ = w.unmaximize();
            }
            let _ = w.set_always_on_top(read_config(&handle).settings.always_on_top);
            // 切ったら、すぐ一番前に出して、操作中のウィンドウにする(Windows のふつうのウィンドウと同じ動き。一番後ろに残さない)
            #[cfg(windows)]
            raise_window(&w);
            let _ = w.set_focus();
        }
    });
}

/// ウィンドウを、重なり順の一番前(最前面の指定がなければ、ふつうのウィンドウの中の一番前)に出す。大きさ・位置・最大化の状態は変えない。
///
/// # 引数
/// * `w` - ランチャーのウィンドウ
#[cfg(windows)]
pub(crate) fn raise_window(w: &tauri::WebviewWindow) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{SetWindowPos, HWND_TOP, SWP_NOMOVE, SWP_NOSIZE};
    if let Ok(h) = w.hwnd() {
        // SAFETY: `h` は、このウィンドウ自身のハンドル。ハンドルが無効でも、`SetWindowPos` は失敗を返すだけ(結果は使わない)。
        unsafe {
            let _ = SetWindowPos(
                HWND(h.0 as _),
                HWND_TOP,
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE,
            );
        }
    }
}

/// デスクトップモードのウィンドウの手続きを取り付け(一度だけ)、すぐ一番後ろへ置く。画面のスレッドから呼ぶこと。
///
/// # 引数
/// * `w` - ランチャーのウィンドウ
#[cfg(windows)]
pub(crate) fn install_desktop_subclass(w: &tauri::WebviewWindow) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::Shell::SetWindowSubclass;
    use windows::Win32::UI::WindowsAndMessaging::{
        SetWindowPos, HWND_BOTTOM, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE,
    };
    static INSTALLED: AtomicBool = AtomicBool::new(false);
    let Ok(h) = w.hwnd() else { return };
    let hwnd = HWND(h.0 as _);
    // SAFETY: `hwnd` は、このウィンドウ自身のハンドル。手続きは、`'static` な関数で、`INSTALLED` により、一度だけ、同じ識別子(1)で取り付ける。ウィンドウを作ったスレッド(画面のスレッド)で呼ぶ。
    unsafe {
        if !INSTALLED.swap(true, Ordering::SeqCst) {
            let _ = SetWindowSubclass(hwnd, Some(desktop_subclass_proc), 1, 0);
        }
        let _ = SetWindowPos(
            hwnd,
            HWND_BOTTOM,
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
        );
    }
}

/// (コマンド)デスクトップモードを入れる/切る。
#[tauri::command]
pub async fn set_desktop_mode(app: AppHandle, enabled: bool) {
    apply_desktop_mode(&app, enabled);
}

/// デスクトップモードのあいだ、最小化されたり最大化が解かれたりしたら、元に戻す(Win+D や Win+↓ などで起きたとき)。
///
/// # 引数
/// * `app` - アプリのハンドル
pub(crate) fn keep_desktop_maximized(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        if w.is_minimized().unwrap_or(false) {
            let _ = w.unminimize();
        }
        if !w.is_maximized().unwrap_or(true) {
            let _ = w.maximize();
        }
    }
}
