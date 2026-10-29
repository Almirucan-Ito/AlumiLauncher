//! ウィンドウ・ショートカットキーのテスト。

use crate::window::hotkey::parse_hotkey;
use crate::window::hotkey::DEFAULT_HOTKEY;
use tauri_plugin_global_shortcut::Modifiers;

#[test]
fn hotkey_strings_are_validated() {
    assert!(
        parse_hotkey("Alt+Space+L").unwrap().second.is_some(),
        "修飾キー+キー+キーは2段階"
    );
    assert!(
        parse_hotkey("Ctrl+Space").unwrap().second.is_none(),
        "2キーはすぐ切り替え"
    );
    let both = parse_hotkey("Ctrl+Alt+L").unwrap();
    assert!(
        both.second.is_none(),
        "修飾キーが2つ + キー1つは、すぐ切り替え"
    );
    assert_eq!(both.trigger.mods, Modifiers::CONTROL | Modifiers::ALT);
    assert!(parse_hotkey("Ctrl+F9").is_some() && parse_hotkey("Shift+Alt+5").is_some());
    for bad in [
        "",
        "L",
        "Ctrl",
        "Space+L",
        "Ctrl+Alt+Shift+L",
        "Ctrl+Ctrl+L",
        "Alt+L+Ctrl",
        "Ctrl+Escape",
        "Ctrl+l",
        "Ctrl+F13",
        "Ctrl+Alt",
    ] {
        assert!(parse_hotkey(bad).is_none(), "{bad} は無効");
    }
    assert!(parse_hotkey(DEFAULT_HOTKEY).is_some());
}
