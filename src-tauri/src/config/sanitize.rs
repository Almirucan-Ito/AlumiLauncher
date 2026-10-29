//! 設定の検査: 範囲外・不正な値を、安全な値に直す。

use crate::config::model::Config;
use crate::config::model::FolderEntry;
use crate::config::model::MIN_HEIGHT;
use crate::config::model::MIN_WIDTH;
use crate::extensions::widgets;
use crate::files::listing::HOME_ORDER_KEY;
use crate::files::listing::MAX_ITEMS;
use crate::files::roots::is_allowed_folder;
use crate::window::hotkey::parse_hotkey;
use crate::window::hotkey::DEFAULT_HOTKEY;
use std::collections::HashMap;
use std::collections::HashSet;
use std::fs;

/// 1 つのプリセットのフォルダ・並び順を検査する。登録できない場所のフォルダは外し、表示名は 100 字まで、並び順は存在するフォルダの分だけ(上限あり)にする。
/// 今つながっていないドライブ上のフォルダなど、存在を確認できないものは、消さずに残す。
///
/// # 引数
/// * `folders` - フォルダの一覧(ここを書き換える)
/// * `orders` - フォルダごとの並び順(ここを書き換える)
pub(crate) fn sanitize_preset(
    folders: &mut Vec<FolderEntry>,
    orders: &mut HashMap<String, Vec<String>>,
) {
    // 起動・削除の対象になるフォルダなので、登録できない場所(ドライブ直下など)は外す
    // (今つながっていないドライブ上のフォルダなど、存在を確認できないものは消さずに残す)
    folders.retain(|f| {
        fs::canonicalize(&f.path)
            .map(|_| is_allowed_folder(&f.path))
            .unwrap_or(true)
    });
    for f in folders.iter_mut() {
        f.name = f.name.chars().take(100).collect();
    }
    let ids: HashSet<&str> = folders.iter().map(|f| f.id.as_str()).collect();
    orders.retain(|id, _| id == HOME_ORDER_KEY || ids.contains(id.as_str()));
    for list in orders.values_mut() {
        list.truncate(MAX_ITEMS);
    }
}

/// 設定を検査して、範囲外の値・不正な値を、安全な値に直す(画面から届いた設定や、手で編集された設定ファイルが対象)。
/// 色・倍率・時間・ウィジェットの ID と置き場所・同意の記録などを、それぞれ許される範囲に収める。
///
/// # 引数
/// * `cfg` - 検査する設定(ここを書き換える)
pub(crate) fn sanitize_config(cfg: &mut Config) {
    // 起動・削除の対象になるフォルダなので、登録できない場所(ドライブ直下など)は外す
    // (今つながっていないドライブ上のフォルダなど、存在を確認できないものは消さずに残す)
    sanitize_preset(&mut cfg.folders, &mut cfg.orders);
    cfg.presets.retain(|k, _| {
        k.parse::<u32>()
            .map(|n| (2..=9).contains(&n))
            .unwrap_or(false)
    });
    for p in cfg.presets.values_mut() {
        sanitize_preset(&mut p.folders, &mut p.orders);
    }

    let s = &mut cfg.settings;
    s.width = s.width.clamp(MIN_WIDTH, 7680.0);
    s.height = s.height.clamp(MIN_HEIGHT, 4320.0);
    if !["gray", "dark", "white", "accent", "custom", "image"].contains(&s.theme.as_str()) {
        s.theme = "gray".into();
    }
    let hex_ok = s.custom_color.len() == 7
        && s.custom_color.starts_with('#')
        && s.custom_color[1..].chars().all(|c| c.is_ascii_hexdigit());
    if !hex_ok {
        s.custom_color = "#3b82f6".into();
    }
    // UI(時計・ボタン・フォルダ内・メニューなど)の色。"auto" は背景のテーマと同じ
    if !["auto", "gray", "dark", "white", "accent", "custom"].contains(&s.ui_theme.as_str()) {
        s.ui_theme = "auto".into();
    }
    let ui_hex_ok = s.ui_color.len() == 7
        && s.ui_color.starts_with('#')
        && s.ui_color[1..].chars().all(|c| c.is_ascii_hexdigit());
    if !ui_hex_ok {
        s.ui_color = "#3b82f6".into();
    }
    s.ui_transparency = s.ui_transparency.min(100);
    s.image_dim = s.image_dim.min(80);
    s.icon_size = s.icon_size.clamp(48, 128);
    s.icon_gap = s.icon_gap.min(60);
    s.bg_transparency = s.bg_transparency.min(100);
    s.modal_transparency = s.modal_transparency.min(100);
    s.modal_blur = s.modal_blur.min(30);
    s.master_volume = s.master_volume.min(100);
    let mut seen = HashSet::new();
    s.network_allowed.retain(|k| {
        let ok = k.len() <= 140
            && (k.starts_with("widget:") || k.starts_with("miniapp:"))
            && k.split_once(':')
                .map(|(_, rest)| {
                    rest.split('/').count() <= 2 && rest.split('/').all(widgets::valid_id)
                })
                .unwrap_or(false);
        ok && seen.insert(k.clone())
    });
    s.network_allowed.truncate(64);
    s.drag_delay_ms = s.drag_delay_ms.clamp(200, 2000);
    s.merge_delay_ms = s.merge_delay_ms.clamp(500, 5000);
    // ウィジェット: 以前の「時計を表示」設定は、ヘッダーの時計ウィジェットへ引き継ぐ
    let legacy_clock = s.show_clock;
    s.header_widgets = Some(clean_widget_ids(s.header_widgets.take().unwrap_or_else(
        || {
            if legacy_clock {
                vec!["clock".into()]
            } else {
                vec![]
            }
        },
    )));
    s.footer_widgets = Some(clean_widget_ids(
        s.footer_widgets.take().unwrap_or_default(),
    ));
    // ウィジェットのデータ: 名前が正しいものだけ、1 つ 64KB まで・16 個まで
    let data = std::mem::take(&mut s.widget_data);
    s.widget_data = data
        .into_iter()
        .filter(|(k, v)| {
            !k.is_empty()
                && k.len() <= 72
                && k.chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
                && v.len() <= 64 * 1024
        })
        .take(32)
        .collect();
    // ウィジェットの置き場所: 欄の名前と ID が正しく、7 マスの中に収まるものだけ
    let cells = std::mem::take(&mut s.widget_cells);
    s.widget_cells = cells
        .into_iter()
        .filter(|(k, [col, span])| {
            let id = k
                .strip_prefix("header:")
                .or_else(|| k.strip_prefix("footer:"));
            id.map(|id| !clean_widget_ids(vec![id.to_string()]).is_empty())
                .unwrap_or(false)
                && (1..=7).contains(col)
                && (1..=7).contains(span)
                && col + span - 1 <= 7 // 開始のマス + 幅 が、7 マスの外へはみ出さない(例: 6 マス目から 3 マスは不可)
        })
        .take(32)
        .collect();
    // ヘッダー・フッターの高さ(縦のマスの数): 小(1)・標準(2)・大(3)のどれか
    s.header_rows = s.header_rows.clamp(1, 3);
    s.footer_rows = s.footer_rows.clamp(1, 3);
    // 大きさの倍率: 使えるウィジェット ID だけ残し、0.5〜4 倍に収める
    let scales = std::mem::take(&mut s.widget_scales);
    s.widget_scales = scales
        .into_iter()
        .filter(|(k, v)| !clean_widget_ids(vec![k.clone()]).is_empty() && v.is_finite())
        .map(|(k, v)| (k, v.clamp(0.5, 4.0)))
        .take(16)
        .collect();
    s.preset_count = s.preset_count.clamp(1, 9);
    s.preset = s.preset.clamp(1, s.preset_count);
    if parse_hotkey(&s.hotkey).is_none() {
        s.hotkey = DEFAULT_HOTKEY.into();
    }
    s.home_icon_count = s.home_icon_count.clamp(1, 64);
    s.modal_icon_count = s.modal_icon_count.clamp(1, 64);
    for mode in [&mut s.home_layout_mode, &mut s.modal_layout_mode] {
        if mode != "auto" && mode != "fixed" {
            *mode = "auto".into();
        }
    }
}

/// ウィジェット ID の一覧を整える。使える ID だけ・重複なし・最大 8 個にする。
/// 使える ID は、組み込み(`clock` など)・`mod:<フォルダ名>`・`mini:<ミニアプリ>/<ウィジェット>`。
///
/// # 引数
/// * `ids` - 整える前の一覧
///
/// # 戻り値
/// 整えた一覧
pub(crate) fn clean_widget_ids(ids: Vec<String>) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for id in ids {
        let ok = if let Some(name) = id.strip_prefix("mod:") {
            widgets::valid_id(name)
        } else if let Some(rest) = id.strip_prefix("mini:") {
            // ミニアプリの中のウィジェット: mini:<ミニアプリ>/<ウィジェット>
            rest.split_once('/')
                .map(|(a, w)| widgets::valid_id(a) && widgets::valid_id(w))
                .unwrap_or(false)
        } else {
            crate::extensions::bundled::generated::BUNDLED_WIDGET_KINDS.contains(&id.as_str())
        };
        if ok && !out.contains(&id) && out.len() < 8 {
            out.push(id);
        }
    }
    out
}
