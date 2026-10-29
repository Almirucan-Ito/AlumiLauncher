//! ウィンドウのイベント(閉じる・大きさや位置の変更)と、グローバルショートカットのイベント。

use crate::extensions::mini_web::sync_mini_web;
use crate::window::desktop_mode::keep_desktop_maximized;
use crate::window::desktop_mode::DESKTOP_MODE;
use crate::window::hotkey::arm_chord;
use crate::window::hotkey::current_spec;
use crate::window::hotkey::disarm_chord;
use crate::window::visibility::hide_main;
use crate::window::visibility::toggle_window;
use std::sync::atomic::Ordering;
use tauri::AppHandle;
use tauri::Manager;
use tauri::Window;
use tauri::WindowEvent;
use tauri_plugin_global_shortcut::Shortcut;
use tauri_plugin_global_shortcut::ShortcutEvent;
use tauri_plugin_global_shortcut::ShortcutState;

/// ウィンドウのイベント。メイン以外(Web ミニアプリのウィンドウなど)のイベントでは、何もしない。
/// ×や Alt+F4 では終了せず、タスクトレイに常駐する。ランチャーの位置・大きさが変わったら、開いている Web ミニアプリのウィンドウも合わせる。
pub(crate) fn on_window_event(window: &Window, event: &WindowEvent) {
    // Web ミニアプリのウィンドウなど、メイン以外のウィンドウのイベントでは、ランチャーを隠さない
    if window.label() != "main" {
        return;
    }
    match event {
        // ×やAlt+F4では終了せず、タスクトレイに常駐する
        WindowEvent::CloseRequested { api, .. } => {
            api.prevent_close();
            hide_main(window.app_handle());
        }
        // ランチャーの位置・大きさが変わったら、開いている Web ミニアプリのウィンドウも合わせる
        WindowEvent::Resized(_) | WindowEvent::Moved(_) => {
            if DESKTOP_MODE.load(Ordering::SeqCst) {
                keep_desktop_maximized(window.app_handle());
            }
            sync_mini_web(window.app_handle())
        }
        _ => {}
    }
}

/// グローバルショートカットが押されたとき。
/// 修飾キー+キーだけの組み合わせなら、すぐにウィンドウを切り替える。2 つ目のキーを待つ組み合わせ(例: Ctrl+K のあと L)なら、
/// 1 つ目で待ち受けを始め、2 つ目が来たら、解除して切り替える。登録・ウィンドウの操作は、ハンドラの外(別スレッド)で行う。
pub(crate) fn on_shortcut(app: &AppHandle, shortcut: &Shortcut, event: ShortcutEvent) {
    if event.state() != ShortcutState::Pressed {
        return;
    }
    let spec = current_spec(app);
    if shortcut.id() == spec.trigger.id() {
        if spec.second.is_some() {
            arm_chord(app); // 修飾キー+キー: 続く 2 つ目のキーを待つ
        } else {
            // 修飾キー+キーだけの組み合わせ: すぐに切り替える(登録/ウィンドウ操作はハンドラの外で)
            let app = app.clone();
            std::thread::spawn(move || toggle_window(&app));
        }
    } else if spec
        .second
        .map(|keys| keys.iter().any(|k| k.id() == shortcut.id()))
        .unwrap_or(false)
    {
        // L: 待ち受けの解除とウィンドウの切り替えは、ハンドラの外(別スレッド)で行う
        let app = app.clone();
        std::thread::spawn(move || {
            if disarm_chord(&app) {
                toggle_window(&app);
            }
        });
    }
}
