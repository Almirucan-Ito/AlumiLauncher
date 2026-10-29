//! 設定(保存・検査・プリセット・ポータブル)のテスト。

use super::folder;
use crate::config::model::store_view;
use crate::config::model::view_of;
use crate::config::model::Config;
use crate::config::sanitize::sanitize_config;
use crate::config::store::portable_dir;
use crate::files::listing::HOME_ORDER_KEY;
use std::fs;

#[test]
fn portable_mode_is_decided_by_a_marker_file_next_to_the_exe() {
    let exe = std::env::current_exe().unwrap();
    let marker = exe.parent().unwrap().join("portable.txt");
    let _ = fs::remove_file(&marker);
    assert!(portable_dir().is_none(), "目印が無ければ、通常どおり");
    fs::write(&marker, "x").unwrap();
    assert_eq!(portable_dir(), Some(exe.parent().unwrap().join("data")));
    let _ = fs::remove_file(&marker);
    assert!(portable_dir().is_none());
}

#[test]
fn network_consents_are_validated() {
    let mut cfg = Config::default();
    cfg.settings.network_allowed = [
        "miniapp:web-sample",
        "widget:x/y",
        "widget:x/y",
        "evil:z",
        "widget:../a",
        "miniapp:a/b/c",
        "widget:ok",
    ]
    .iter()
    .map(|s| s.to_string())
    .collect();
    sanitize_config(&mut cfg);
    assert_eq!(
        cfg.settings.network_allowed,
        vec![
            "miniapp:web-sample".to_string(),
            "widget:x/y".to_string(),
            "widget:ok".to_string()
        ]
    );
}

#[test]
fn widget_cells_are_validated() {
    let mut cfg = Config::default();
    cfg.settings.widget_cells = [
        ("header:clock".to_string(), [3, 5]),
        ("footer:music".to_string(), [6, 3]), // 7 を超える
        ("header:evil".to_string(), [1, 1]),
        ("side:clock".to_string(), [1, 1]),
        ("footer:todo".to_string(), [0, 2]),
        ("footer:mini:a/w".to_string(), [1, 2]),
    ]
    .into_iter()
    .collect();
    sanitize_config(&mut cfg);
    let mut keys: Vec<_> = cfg.settings.widget_cells.keys().cloned().collect();
    keys.sort();
    assert_eq!(
        keys,
        vec!["footer:mini:a/w".to_string(), "header:clock".to_string()]
    );
}

#[test]
fn widget_data_is_filtered() {
    let mut cfg = Config::default();
    cfg.settings.widget_data = [
        ("todo".to_string(), "[]".to_string()),
        ("bad key".to_string(), "x".to_string()),
        ("big".to_string(), "a".repeat(70_000)),
    ]
    .into_iter()
    .collect();
    sanitize_config(&mut cfg);
    assert_eq!(cfg.settings.widget_data.len(), 1);
}

#[test]
fn widget_settings_are_sanitized_and_migrated() {
    let mut cfg = Config::default();
    cfg.settings.show_clock = false;
    sanitize_config(&mut cfg);
    assert_eq!(
        cfg.settings.header_widgets,
        Some(vec![]),
        "旧設定で時計オフなら空のまま"
    );
    let mut cfg = Config::default();
    sanitize_config(&mut cfg);
    assert_eq!(cfg.settings.header_widgets, Some(vec!["clock".to_string()]));
    let mut cfg = Config::default();
    cfg.settings.footer_widgets = Some(vec![
        "todo".into(),
        "todo".into(),
        "mod:ok-1".into(),
        "mod:../x".into(),
        "evil".into(),
        "memo".into(),
        "mini:a-1/w.2".into(),
        "mini:a/../b".into(),
    ]);
    sanitize_config(&mut cfg);
    assert_eq!(
        cfg.settings.footer_widgets,
        Some(vec![
            "todo".to_string(),
            "mod:ok-1".to_string(),
            "mini:a-1/w.2".to_string()
        ])
    );
    cfg.settings.widget_scales = [
        ("clock".to_string(), 99.0),
        ("evil".to_string(), 1.0),
        ("todo".to_string(), f64::NAN),
    ]
    .into_iter()
    .collect();
    sanitize_config(&mut cfg);
    assert_eq!(cfg.settings.widget_scales.get("clock"), Some(&4.0));
    assert_eq!(cfg.settings.widget_scales.len(), 1);
}

#[test]
fn presets_keep_their_own_folders_and_old_configs_are_preset_1() {
    // 以前の設定ファイル(presets なし)は、プリセット 1 として読まれる
    let old: Config = serde_json::from_str(
        r#"{"folders":[{"id":"a","name":"A","path":"C:\\x"}],"orders":{"a":["p"]},"settings":{}}"#,
    )
    .unwrap();
    assert_eq!(old.settings.preset, 1);
    assert!(old.settings.presets_enabled);
    assert_eq!(view_of(&old).folders.len(), 1);

    let mut full = old.clone();
    full.settings.preset = 2;
    full.settings.preset_count = 5;
    assert!(view_of(&full).folders.is_empty(), "プリセット 2 は最初は空");
    let mut v = view_of(&full);
    v.folders.push(folder("b", "C:\\y"));
    store_view(&mut full, v);
    assert_eq!(full.folders.len(), 1, "プリセット 1 は変わらない");
    assert_eq!(view_of(&full).folders[0].id, "b");

    full.settings.presets_enabled = false; // 使わない設定のときは、常にプリセット 1
    assert_eq!(view_of(&full).folders[0].id, "a");
    let json = serde_json::to_string(&old).unwrap();
    assert!(
        !json.contains("\"presets\""),
        "プリセット 2・3 が空なら、ファイルには書かない"
    );
}

#[test]
fn sanitize_fixes_out_of_range_values() {
    let temp = std::env::temp_dir().to_string_lossy().into_owned();
    let mut cfg = Config {
        folders: vec![
            folder("ok", &temp),
            folder("root", "C:\\"),
            folder("offline", "Z:\\not\\connected"),
        ],
        ..Default::default()
    };
    cfg.orders.insert("ok".into(), vec!["a".into()]);
    cfg.orders.insert("gone".into(), vec!["b".into()]);
    cfg.orders
        .insert(HOME_ORDER_KEY.into(), vec!["f:ok".into()]);
    cfg.settings.width = 99999.0;
    cfg.settings.icon_size = 1;
    cfg.settings.theme = "<script>".into();
    cfg.settings.custom_color = "red; background:url(x)".into();
    cfg.settings.home_layout_mode = "weird".into();
    cfg.settings.modal_icon_count = 0;

    sanitize_config(&mut cfg);

    let ids: Vec<&str> = cfg.folders.iter().map(|f| f.id.as_str()).collect();
    assert_eq!(ids, ["ok", "offline"]); // ドライブ直下は外し、接続されていないドライブのものは残す
    assert!(cfg.orders.contains_key("ok") && !cfg.orders.contains_key("gone"));
    assert!(
        cfg.orders.contains_key(HOME_ORDER_KEY),
        "ホームの並び順は消さない"
    );
    assert_eq!(cfg.settings.width, 7680.0);
    assert_eq!(cfg.settings.icon_size, 48);
    assert_eq!(cfg.settings.theme, "gray");
    assert_eq!(cfg.settings.custom_color, "#3b82f6");
    assert_eq!(cfg.settings.home_layout_mode, "auto");
    assert_eq!(cfg.settings.modal_icon_count, 1);
    cfg.settings.drag_delay_ms = 5;
    cfg.settings.merge_delay_ms = 99999;
    sanitize_config(&mut cfg);
    assert_eq!(
        (cfg.settings.drag_delay_ms, cfg.settings.merge_delay_ms),
        (200, 5000)
    );
}

#[test]
fn bar_rows_are_clamped_to_small_standard_large() {
    let mut cfg = Config::default();
    assert_eq!(
        (cfg.settings.header_rows, cfg.settings.footer_rows),
        (2, 2),
        "初めは標準(2)"
    );
    cfg.settings.header_rows = 0;
    cfg.settings.footer_rows = 99;
    sanitize_config(&mut cfg);
    assert_eq!(cfg.settings.header_rows, 1, "1 マス以上");
    assert_eq!(cfg.settings.footer_rows, 3, "3 マスまで");
    cfg.settings.header_rows = 3;
    cfg.settings.footer_rows = 1;
    sanitize_config(&mut cfg);
    assert_eq!((cfg.settings.header_rows, cfg.settings.footer_rows), (3, 1));
}

#[test]
fn old_config_without_bar_rows_gets_the_standard_height() {
    let cfg: Config = serde_json::from_str(r#"{"folders":[],"settings":{"width":520.0}}"#).unwrap();
    assert_eq!((cfg.settings.header_rows, cfg.settings.footer_rows), (2, 2));
}
