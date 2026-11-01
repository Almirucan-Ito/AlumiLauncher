//! 起動時の初期化(Tauri の `setup`)。データの準備・設定の読み込み・タスクトレイ・ウィンドウの初期位置と大きさ・ショートカットの登録を、順に行う。

use crate::config::model::default_config;
use crate::config::model::MIN_HEIGHT;
use crate::config::model::MIN_WIDTH;
use crate::config::store::config_path;
use crate::config::store::data_dir;
use crate::config::store::flush_config;
use crate::config::store::load_config_file;
use crate::config::store::read_config;
use crate::extensions::bundled::ensure_bundled_miniapps;
use crate::extensions::bundled::ensure_bundled_widgets;
use crate::files::listing::launcher_dir_for;
use crate::files::operations::cleanup_unused_folders;
use crate::files::roots::refresh_roots;
use crate::files::roots::spawn_watch_debouncer;
use crate::logging;
use crate::platform::locale::is_ja;
use crate::state::AppState;
use crate::state::LockExt;
use crate::window::desktop_mode::apply_desktop_mode;
use crate::window::hotkey::apply_hotkeys;
use crate::window::hotkey::parse_hotkey;
use crate::window::hotkey::DEFAULT_HOTKEY;
use crate::window::hotkey::OLD_DEFAULT_HOTKEY;
use crate::window::tray::show_label;
use crate::window::tray::TrayAutostart;
use crate::window::tray::TrayShow;
use crate::window::visibility::disable_browser_accelerators;
use crate::window::visibility::disable_round_corners;
use crate::window::visibility::mark_ready;
use crate::window::visibility::set_low_memory;
use crate::window::visibility::show_window;
use crate::window::visibility::toggle_window;
use std::fs;
use std::sync::atomic::Ordering;
use std::time::Duration;
use tauri::menu::CheckMenuItem;
use tauri::menu::Menu;
use tauri::menu::MenuItem;
use tauri::menu::PredefinedMenuItem;
use tauri::tray::MouseButton;
use tauri::tray::MouseButtonState;
use tauri::tray::TrayIconBuilder;
use tauri::tray::TrayIconEvent;
use tauri::AppHandle;
use tauri::Manager;
use tauri_plugin_autostart::ManagerExt;

/// 起動時の初期化。`tauri::Builder` の `setup` から呼ぶ。
///
/// # 引数
/// * `app` - 組み立て中のアプリ
///
/// # 戻り値
/// 成功なら `Ok(())`。トレイのメニューを作れなかったときはエラー
pub(crate) fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.handle().clone();
    prepare_data(&handle);
    let autostart_enabled = ensure_config_file(app, &handle);
    load_config_into_state(&handle);
    build_tray(app, &handle, autostart_enabled)?;
    place_main_window(app, &handle);
    register_hotkeys(&handle);
    Ok(())
}

/// 記録(ログ)を始め、同梱のミニアプリ・ウィジェットを書き出す。
fn prepare_data(handle: &AppHandle) {
    if let Ok(dir) = data_dir(handle) {
        logging::init(&dir);
    }
    ensure_bundled_miniapps(handle);
    ensure_bundled_widgets(handle);
}

/// 初回起動なら、設定ファイルを作る(スタートアップ登録は、利用者が設定で選ぶまで行わない)。
///
/// # 戻り値
/// Windows 起動時の自動起動が、いま有効か(トレイのチェックに使う)
fn ensure_config_file(app: &tauri::App, handle: &AppHandle) -> bool {
    let autolaunch = app.autolaunch();
    if let Ok(p) = config_path(handle) {
        if !p.exists() {
            if let Ok(json) = serde_json::to_string_pretty(&default_config()) {
                let _ = fs::write(&p, json);
            }
        }
    }
    autolaunch.is_enabled().unwrap_or(false)
}

/// 設定をメモリに読み込む(以降は画面からの保存で更新し、ディスクへは遅延して書く)。
/// 古い既定のショートカットを新しい既定に直し、以前のバージョンが一覧に自動追加したフォルダを外し、ファイルの見張りと、操作してよいフォルダの一覧を用意する。
fn load_config_into_state(handle: &AppHandle) {
    let mut cfg = load_config_file(handle);
    if cfg.settings.hotkey == OLD_DEFAULT_HOTKEY {
        cfg.settings.hotkey = DEFAULT_HOTKEY.into();
        handle
            .state::<AppState>()
            .dirty
            .store(true, Ordering::SeqCst);
    }
    // 以前のバージョンが一覧に自動追加した「launcherFolder のフォルダタイル」は外す
    // (今は中のショートカットが、アイコンとしてホームに直接並ぶ)
    for n in 1..=9 {
        if let Some(dir) = launcher_dir_for(handle, n).and_then(|d| fs::canonicalize(d).ok()) {
            cfg.folders
                .retain(|f| fs::canonicalize(&f.path).ok().as_ref() != Some(&dir));
            for p in cfg.presets.values_mut() {
                p.folders
                    .retain(|f| fs::canonicalize(&f.path).ok().as_ref() != Some(&dir));
            }
        }
    }
    *handle.state::<AppState>().config.lock_ok() = cfg;
    spawn_watch_debouncer(handle);
    refresh_roots(handle);
    // 使われなくなったフォルダは、起動時に削除する(元に戻す/やり直しが効く間は残しておくため、起動時だけ)
    cleanup_unused_folders(handle);
}

/// タスクトレイのアイコンとメニュー(表示・自動起動・終了)を作る。左クリックで、ウィンドウを切り替える。
///
/// # 引数
/// * `autostart_enabled` - Windows 起動時の自動起動が、いま有効か(メニューのチェックの初期値)
fn build_tray(app: &tauri::App, handle: &AppHandle, autostart_enabled: bool) -> tauri::Result<()> {
    let ja = is_ja();
    let combo = read_config(handle).settings.hotkey;
    let show_item = MenuItem::with_id(app, "show", show_label(&combo), true, None::<&str>)?;
    let auto_item = CheckMenuItem::with_id(
        app,
        "autostart",
        if ja {
            "Windows 起動時に自動で起動"
        } else {
            "Start with Windows"
        },
        true,
        autostart_enabled,
        None::<&str>,
    )?;
    let quit_item = MenuItem::with_id(
        app,
        "quit",
        if ja { "終了" } else { "Quit" },
        true,
        None::<&str>,
    )?;
    let menu = Menu::with_items(
        app,
        &[
            &show_item,
            &auto_item,
            &PredefinedMenuItem::separator(app)?,
            &quit_item,
        ],
    )?;
    let auto_for_event = auto_item.clone();
    // 設定画面からスタートアップを切り替えたときに、トレイのチェックも合わせる
    app.manage(TrayAutostart(auto_item.clone()));
    app.manage(TrayShow(show_item.clone()));
    let tray = TrayIconBuilder::new()
        .tooltip("AlumiLauncher")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "show" => show_window(app),
            "quit" => {
                flush_config(app);
                app.exit(0);
            }
            "autostart" => {
                let al = app.autolaunch();
                if auto_for_event.is_checked().unwrap_or(false) {
                    let _ = al.enable();
                } else {
                    let _ = al.disable();
                }
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_window(tray.app_handle());
            }
        });
    // 既定のアイコンが無くても、トレイは作る(アイコンだけ、付けない)
    let tray = match app.default_window_icon() {
        Some(icon) => tray.icon(icon.clone()),
        None => tray,
    };
    tray.build(app)?;
    Ok(())
}

/// メインウィンドウの、初めの大きさ・位置・最前面・デスクトップモードを決め、出すタイミングを決める。
/// スタートアップ起動(`--hidden`)のときは、隠したまま常駐する(デスクトップモードのときと、`startup_show_window` がオンのときは、隠さない)。
/// 画面からの用意の知らせが届かなくても、数秒後には出せるようにする(読み込みに失敗しても、ランチャーが開けなくならないように)。
fn place_main_window(app: &tauri::App, handle: &AppHandle) {
    let Some(w) = app.get_webview_window("main") else {
        return;
    };
    #[cfg(windows)]
    {
        disable_round_corners(&w);
        disable_browser_accelerators(&w);
    }
    // 設定した既定のウィンドウサイズで開く
    let s = read_config(handle).settings;
    // 範囲外の値(手で編集された設定など)で異常なサイズにならないよう丸める
    let _ = w.set_size(tauri::LogicalSize::new(
        s.width.clamp(MIN_WIDTH, 7680.0),
        s.height.clamp(MIN_HEIGHT, 4320.0),
    ));
    let _ = w.set_always_on_top(s.always_on_top && !s.desktop_mode);
    let _ = w.center();
    if s.desktop_mode {
        apply_desktop_mode(handle, true);
    }
    // スタートアップ起動(--hidden)のときは隠したまま常駐(デスクトップモードのときと、「起動時にウィンドウを出す」設定のときは、隠さない)
    if std::env::args().any(|a| a == "--hidden") && !s.desktop_mode && !s.startup_show_window {
        #[cfg(windows)]
        set_low_memory(&w, true);
    } else {
        #[cfg(windows)]
        set_low_memory(&w, true);
        // アイコンの用意ができてから出す(画面側から app_ready が届く)
        handle
            .state::<AppState>()
            .want_show
            .store(true, Ordering::SeqCst);
    }
    // 画面の用意が届かなくても、数秒後には出せるようにする(読み込みに失敗しても、ランチャーが開けなくならないように)
    let late = handle.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(6));
        mark_ready(&late);
    });
}

/// 設定のショートカットを読み込み、有効なら登録する。
fn register_hotkeys(handle: &AppHandle) {
    *handle.state::<AppState>().hotkey.lock_ok() =
        parse_hotkey(&read_config(handle).settings.hotkey);
    apply_hotkeys(handle, read_config(handle).settings.hotkey_enabled);
}
