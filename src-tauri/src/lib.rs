//! AlumiLauncher の本体(Rust)。画面(`src/`)から呼ばれるコマンドと、Windows の機能を受け持つ。
//!
//! - `config`: 設定ファイルの型・保存・検査 / `files`: フォルダとファイルの操作 / `extensions`: ミニアプリ・ウィジェット
//! - `window`: ウィンドウ・ショートカットキー・トレイ・デスクトップモード・それらのイベント / `platform`: Windows のシェルの機能
//! - `protocols`: `widget://` と `miniapp://` の配信 / `startup`: 起動時の初期化
//! - `state`: アプリ全体で共有する状態 / `tests`: テスト

mod config;
mod extensions;
mod files;
mod logging;
mod platform;
mod protocols;
mod startup;
mod state;
#[cfg(test)]
mod tests;
mod window;

use crate::config::store::portable_dir;
use crate::state::AppState;
use crate::window::events::on_shortcut;
use crate::window::events::on_window_event;
use crate::window::visibility::show_window;
use std::fs;
use tauri_plugin_autostart::MacosLauncher;

/// アプリの入り口。ポータブル版なら WebView2 のデータの置き場を設定してから、Tauri のアプリを組み立てて起動する。
/// プラグイン(二重起動の防止・ファイルダイアログ・自動起動・グローバルショートカット)、`widget` / `miniapp` プロトコル(`protocols`)、コマンドの登録、ウィンドウのイベント(`window::events`)、起動時の初期化(`startup`)をここでまとめる。
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // ポータブル版: 画面表示(WebView2)のデータも、exe の隣の data フォルダに置く(PC のほかの場所に、何も残さない)
    if let Some(d) = portable_dir() {
        let wv = d.join("webview");
        if fs::create_dir_all(&wv).is_ok() {
            std::env::set_var("WEBVIEW2_USER_DATA_FOLDER", &wv);
        }
    }

    tauri::Builder::default()
        // 二重起動したら既存のウィンドウを前に出す
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_window(app)
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(on_shortcut)
                .build(),
        )
        .manage(AppState::default())
        // 追加ウィジェット・ミニアプリのファイルを渡す(それぞれのフォルダの中だけ)
        .register_uri_scheme_protocol("widget", protocols::widget)
        .register_uri_scheme_protocol("miniapp", protocols::miniapp)
        .invoke_handler(tauri::generate_handler![
            crate::config::commands::load_config,
            crate::config::commands::save_config,
            crate::files::listing::list_items,
            crate::files::listing::get_icon,
            crate::files::listing::get_launcher_folder,
            crate::files::background::get_accent_color,
            crate::config::commands::validate_folder,
            crate::window::hotkey::hotkey_registered,
            crate::window::hotkey::set_hotkey,
            crate::config::commands::set_preset_mode,
            crate::platform::commands::start_file_drag,
            crate::window::visibility::set_always_on_top,
            crate::window::desktop_mode::set_desktop_mode,
            crate::files::listing::filter_dirs,
            crate::files::operations::add_to_folder,
            crate::files::operations::add_to_launcher_folder,
            crate::platform::commands::write_log,
            crate::platform::commands::list_start_apps,
            crate::platform::commands::add_start_app,
            crate::files::operations::move_item,
            crate::files::operations::move_all,
            crate::files::operations::create_folder,
            crate::files::text_files::create_text_file,
            crate::extensions::catalog::list_widgets,
            crate::extensions::catalog::open_widget_dir,
            crate::files::usage::list_usage,
            crate::extensions::catalog::list_miniapps,
            crate::extensions::catalog::open_miniapp_dir,
            crate::extensions::catalog::open_miniapp_widgets_dir,
            crate::extensions::catalog::open_widgets_root,
            crate::extensions::media::music_register,
            crate::extensions::media::image_register,
            crate::extensions::media::image_scan_folder,
            crate::files::text_files::read_text_file,
            crate::files::text_files::write_text_file,
            crate::extensions::storage::app_data_load,
            crate::extensions::storage::app_data_set,
            crate::extensions::storage::app_cache_get,
            crate::extensions::storage::app_cache_set,
            crate::extensions::storage::app_storage_info,
            crate::extensions::storage::app_clear,
            crate::extensions::storage::app_clear_all,
            crate::extensions::media::music_scan_folder,
            crate::extensions::mini_web::mini_web_volume,
            crate::extensions::catalog::open_miniapps_root,
            crate::extensions::catalog::create_miniapp_shortcut,
            crate::extensions::catalog::miniapp_of_file,
            crate::extensions::catalog::install_extensions,
            crate::extensions::mini_web::mini_web_open,
            crate::extensions::mini_web::mini_web_close,
            crate::window::visibility::bring_to_front,
            crate::window::tray::get_autostart,
            crate::window::tray::set_autostart,
            crate::files::operations::delete_item,
            crate::files::shell_ops::open_with,
            crate::files::shell_ops::show_properties,
            crate::window::visibility::hide_window,
            crate::window::visibility::quit_app,
            crate::window::visibility::app_ready,
            crate::window::hotkey::set_hotkeys_enabled,
            crate::files::background::import_background,
            crate::files::background::load_background,
            crate::files::shell_ops::reveal,
            crate::files::usage::launch
        ])
        .on_window_event(on_window_event)
        .setup(startup::setup)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
