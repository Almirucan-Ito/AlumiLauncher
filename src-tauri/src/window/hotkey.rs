//! グローバルショートカット(1 段階・2 段階)の解析と登録。

use crate::state::AppState;
use crate::state::LockExt;
use crate::window::tray::show_label;
use crate::window::tray::TrayShow;
use std::sync::atomic::AtomicBool;
use std::sync::atomic::AtomicU64;
use std::sync::atomic::Ordering;
use std::time::Duration;
use tauri::AppHandle;
use tauri::Manager;
use tauri_plugin_global_shortcut::Code;
use tauri_plugin_global_shortcut::GlobalShortcutExt;
use tauri_plugin_global_shortcut::Modifiers;
use tauri_plugin_global_shortcut::Shortcut;

// ショートカットは、利用者が 2〜3 キーで決められる(設定の `hotkey`。例: "Ctrl+Space" / "Ctrl+Alt+L" / "Alt+Space+L")。
//   ・修飾キー(Ctrl / Alt / Shift / Win)のあとに 1 キー … その組み合わせを押すと、すぐに表示/非表示を切り替える
//   ・修飾キー + キー + キー … 最初の「修飾キー+キー」を押すと、約1.5秒だけ 2 つ目のキーを待ち受け、
//     その間に押されたら(押したままでも、離してからでもよい)切り替える。既定の「Alt+Space+L」はこの形
// キーボードを常時監視する仕組み(キーフック)は使わない。2 つ目のキーは待ち受け中の1.5秒間だけ他のアプリに届かない。
/// 2 つ目のキーを待ち受け中か(2 段階のショートカット用)。
pub(crate) static CHORD_ARMED: AtomicBool = AtomicBool::new(false);

/// 待ち受けの世代番号。新しく待ち受けを始めるたびに増やし、古い待ち受けの自動解除が、新しいものを解除しないようにする。
pub(crate) static CHORD_TOKEN: AtomicU64 = AtomicU64::new(0);

/// 2 段階のショートカットで、2 つ目のキーを待つ時間(ミリ秒)。
pub(crate) const CHORD_WINDOW_MS: u64 = 1500;

/// ショートカットの既定の組み合わせ。
pub(crate) const DEFAULT_HOTKEY: &str = "Ctrl+Alt+L";

/// 以前の既定。設定ファイルにこの値が入っていたら、新しい既定へ付け替える
pub(crate) const OLD_DEFAULT_HOTKEY: &str = "Alt+Space+L";

/// グローバルショートカットの設定(解析済み)。`trigger` が 1 つ目の「修飾キー+キー」、`second` は 2 段階のときだけ、2 つ目のキー(修飾キー付きとキー単独の両方)。
#[derive(Clone)]
pub(crate) struct HotkeySpec {
    pub(crate) trigger: Shortcut,
    /// 2段階のときだけ: 2 つ目のキー(修飾キー付きと、キー単独の両方)
    pub(crate) second: Option<[Shortcut; 2]>,
}

/// 修飾キーの名前を読む。
///
/// # 引数
/// * `name` - `"Ctrl"` / `"Alt"` / `"Shift"` / `"Win"`
///
/// # 戻り値
/// 対応する修飾キー。違う名前なら `None`
pub(crate) fn parse_modifier(name: &str) -> Option<Modifiers> {
    match name {
        "Ctrl" => Some(Modifiers::CONTROL),
        "Alt" => Some(Modifiers::ALT),
        "Shift" => Some(Modifiers::SHIFT),
        "Win" => Some(Modifiers::SUPER),
        _ => None,
    }
}

/// キーの名前を読む。使えるのは、英大文字 1 文字・数字 1 文字・`Space` / `Tab` / `Enter` / `Backquote` / `Minus` / `Equal` / `Comma` / `Period` / `Slash`・`F1`〜`F12`。
///
/// # 引数
/// * `name` - キーの名前
///
/// # 戻り値
/// 対応するキー。使えない名前なら `None`
pub(crate) fn parse_code(name: &str) -> Option<Code> {
    let code = if name.len() == 1 && name.chars().all(|c| c.is_ascii_uppercase()) {
        format!("Key{name}")
    } else if name.len() == 1 && name.chars().all(|c| c.is_ascii_digit()) {
        format!("Digit{name}")
    } else if matches!(
        name,
        "Space" | "Tab" | "Enter" | "Backquote" | "Minus" | "Equal" | "Comma" | "Period" | "Slash"
    ) || (name.starts_with('F')
        && name[1..]
            .parse::<u8>()
            .map(|n| (1..=12).contains(&n))
            .unwrap_or(false))
    {
        name.to_string()
    } else {
        return None;
    };
    code.parse::<Code>().ok()
}

/// `"Alt+Space+L"` のような文字列を読む。先頭が修飾キーで、全体が 2〜3 キーのものだけ有効。
///
/// # 引数
/// * `s` - ショートカットの文字列
///
/// # 戻り値
/// 解析した設定。形が正しくなければ `None`
pub(crate) fn parse_hotkey(s: &str) -> Option<HotkeySpec> {
    let parts: Vec<&str> = s.split('+').collect();
    if !(2..=3).contains(&parts.len()) {
        return None;
    }
    // 先頭から、修飾キー(Ctrl / Alt / Shift / Win)が続く間だけ読む。同じ修飾キーの重複は不可。残りが、通常のキー(1〜2 個)
    let mut mods = Modifiers::empty();
    let mut i = 0;
    while i < parts.len() {
        match parse_modifier(parts[i]) {
            Some(m) if !mods.contains(m) => mods |= m,
            Some(_) => return None,
            None => break,
        }
        i += 1;
    }
    let keys: Vec<Code> = parts[i..]
        .iter()
        .map(|n| parse_code(n))
        .collect::<Option<_>>()?;
    if mods.is_empty() || keys.is_empty() || keys.len() > 2 || i + keys.len() != parts.len() {
        return None;
    }
    Some(HotkeySpec {
        trigger: Shortcut::new(Some(mods), keys[0]),
        second: keys
            .get(1)
            .map(|k| [Shortcut::new(Some(mods), *k), Shortcut::new(None, *k)]),
    })
}

/// いま登録しているショートカットの設定を返す(未設定なら既定のもの)。
///
/// # 戻り値
/// ショートカットの設定
pub(crate) fn current_spec(app: &AppHandle) -> HotkeySpec {
    if let Some(s) = app.state::<AppState>().hotkey.lock_ok().clone() {
        return s;
    }
    parse_hotkey(DEFAULT_HOTKEY).expect("default hotkey")
}

/// 2 つ目のキーの待ち受けを解除する(登録していたキーを外す)。
///
/// # 戻り値
/// 待ち受け中だったときだけ `true`
pub(crate) fn disarm_chord(app: &AppHandle) -> bool {
    if CHORD_ARMED.swap(false, Ordering::SeqCst) {
        if let Some(keys) = current_spec(app).second {
            let gs = app.global_shortcut();
            for key in keys {
                let _ = gs.unregister(key);
            }
        }
        true
    } else {
        false
    }
}

/// 2 つ目のキーの待ち受けを始め、`CHORD_WINDOW_MS`(1.5 秒)たつと自動的に解除する。登録・解除は別スレッドで行う(ショートカットのハンドラの中で行うと、固まるため)。
///
/// # 引数
/// * `app` - アプリのハンドル
pub(crate) fn arm_chord(app: &AppHandle) {
    let token = CHORD_TOKEN.fetch_add(1, Ordering::SeqCst) + 1;
    let app = app.clone();
    std::thread::spawn(move || {
        if !CHORD_ARMED.swap(true, Ordering::SeqCst) {
            if let Some(keys) = current_spec(&app).second {
                let gs = app.global_shortcut();
                for key in keys {
                    let _ = gs.register(key);
                }
            }
        }
        std::thread::sleep(Duration::from_millis(CHORD_WINDOW_MS));
        if CHORD_TOKEN.load(Ordering::SeqCst) == token {
            disarm_chord(&app);
        }
    });
}

/// グローバルショートカットの登録/解除をする(他のアプリが使用中で登録できなくても、起動は続ける)。
///
/// # 引数
/// * `app` - アプリのハンドル
/// * `enabled` - 有効にするか
pub(crate) fn apply_hotkeys(app: &AppHandle, enabled: bool) {
    let gs = app.global_shortcut();
    disarm_chord(app);
    let spec = current_spec(app);
    let _ = gs.unregister(spec.trigger);
    if enabled {
        let _ = gs.register(spec.trigger);
    }
}

/// (コマンド)ショートカットが実際に登録できているか(他のアプリが同じ組み合わせを使っていると失敗する)。
#[tauri::command]
pub async fn hotkey_registered(app: AppHandle) -> bool {
    app.global_shortcut()
        .is_registered(current_spec(&app).trigger)
}

/// (コマンド)ショートカットの登録/解除をして、その結果を返す。
///
/// # 戻り値
/// 利用可能な状態なら `true`(有効にしたのに登録できなければ `false`)
#[tauri::command]
pub async fn set_hotkeys_enabled(app: AppHandle, enabled: bool) -> bool {
    apply_hotkeys(&app, enabled);
    !enabled
        || app
            .global_shortcut()
            .is_registered(current_spec(&app).trigger)
}

/// (コマンド)ショートカットの組み合わせを変える。登録できなかったとき(他のアプリが使用中など)は、元のままにして `false` を返す。
///
/// # 引数
/// * `combo` - 新しい組み合わせ(例: `"Ctrl+Alt+L"`)
/// * `enabled` - ショートカットを有効にしているか
///
/// # 戻り値
/// 変えられたら `Ok(true)`。登録できなければ `Ok(false)`。形が不正ならエラー
#[tauri::command]
pub async fn set_hotkey(app: AppHandle, combo: String, enabled: bool) -> Result<bool, String> {
    let new = parse_hotkey(&combo).ok_or_else(|| "invalid".to_string())?;
    let gs = app.global_shortcut();
    disarm_chord(&app);
    let old = current_spec(&app);
    let _ = gs.unregister(old.trigger);
    if enabled && gs.register(new.trigger).is_err() {
        let _ = gs.register(old.trigger);
        return Ok(false);
    }
    *app.state::<AppState>().hotkey.lock_ok() = Some(new);
    if let Some(item) = app.try_state::<TrayShow>() {
        let _ = item.0.set_text(show_label(&combo));
    }
    Ok(true)
}
