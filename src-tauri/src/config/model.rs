//! 設定ファイル(`config.json`)の中身の型(設定・フォルダ・プリセット・起動の記録)と、画面へ渡す見え方。

use crate::platform::locale::is_ja;
use crate::window::hotkey::DEFAULT_HOTKEY;
use serde::Deserialize;
use serde::Serialize;
use std::collections::HashMap;

/// ウィンドウの最小の大きさ(横 240px・縦 60px。tauri.conf.json の minWidth / minHeight と同じ)
pub(crate) const MIN_WIDTH: f64 = 240.0;

/// ウィンドウの最小の高さ(論理 px)。
pub(crate) const MIN_HEIGHT: f64 = 60.0;

/// ホームに登録した 1 つのフォルダ(設定ファイルの `folders` の 1 要素)。
/// `id` は一意な識別子、`name` は表示名(元のフォルダ名とは別に変えられる)、`path` は実際のフォルダの絶対パス。
#[derive(Serialize, Deserialize, Clone)]
pub(crate) struct FolderEntry {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) path: String,
}

/// 利用者が変えられる設定すべて(設定ファイルの `settings`)。
/// 画面(フロント)と同じ名前(`camelCase`)で JSON に保存する。足りない項目は `Default` の値になる。
/// 範囲外の値・不正な値は、`sanitize_config` が安全な値に直す。
#[derive(Serialize, Deserialize, Clone)]
#[serde(default)]
pub(crate) struct Settings {
    pub(crate) width: f64,
    pub(crate) height: f64,
    /// "gray" | "dark" | "white" | "accent" | "custom" | "image"
    pub(crate) theme: String,
    #[serde(rename = "customColor")]
    pub(crate) custom_color: String,
    /// UI(時計・ボタン・フォルダ内・メニューなど)の色: "auto"(背景と同じ) | "gray" | "dark" | "white" | "accent" | "custom"
    #[serde(rename = "uiTheme")]
    pub(crate) ui_theme: String,
    /// UI の「好きな色」
    #[serde(rename = "uiColor")]
    pub(crate) ui_color: String,
    /// UI(メニュー・設定・ダイアログ・ボタン)の透過度(0-100)
    #[serde(rename = "uiTransparency")]
    pub(crate) ui_transparency: u32,
    /// 背景画像の暗さ(0-80)
    #[serde(rename = "imageDim")]
    pub(crate) image_dim: u32,
    /// アイコン(プレート)の最大サイズ(px)
    #[serde(rename = "iconSize")]
    pub(crate) icon_size: u32,
    /// アイコン同士の間隔(px)
    #[serde(rename = "iconGap")]
    pub(crate) icon_gap: u32,
    /// 背景の透過度(0-100、大きいほど透ける)
    #[serde(rename = "bgTransparency")]
    pub(crate) bg_transparency: u32,
    /// 表示数: "auto"(画面サイズに合わせる) | "fixed"(個数を指定)
    #[serde(rename = "homeLayoutMode")]
    pub(crate) home_layout_mode: String,
    /// ホーム(フォルダ一覧)で個数を指定したときの1ページの表示数
    #[serde(rename = "homeIconCount")]
    pub(crate) home_icon_count: u32,
    /// フォルダを開いたモーダル側の表示数モード("auto" | "fixed")
    #[serde(rename = "modalLayoutMode")]
    pub(crate) modal_layout_mode: String,
    /// モーダルで個数を指定したときの1ページの表示数
    #[serde(rename = "modalIconCount")]
    pub(crate) modal_icon_count: u32,
    /// グローバルショートカット(Alt+Space+L)で開くか
    #[serde(rename = "hotkeyEnabled")]
    pub(crate) hotkey_enabled: bool,
    /// ショートカットの組み合わせ(例: "Alt+Space+L")。2〜3キー、先頭は修飾キー
    pub(crate) hotkey: String,
    /// 常に最前面に表示するか
    #[serde(rename = "alwaysOnTop")]
    pub(crate) always_on_top: bool,
    /// デスクトップモード(デスクトップの代わりに使う): 常に一番後ろ・最大化したまま固定・閉じる/最小化/最大化をしない。画面をクリックすれば操作できる(そのときも、一番後ろのまま)
    #[serde(rename = "desktopMode")]
    pub(crate) desktop_mode: bool,
    /// 画像・動画を、アイコンではなくプレビュー(中身の縮小画像)で表示するか
    #[serde(rename = "previewThumbnails")]
    pub(crate) preview_thumbnails: bool,
    /// プリセットを使うか。使わないときは、常にプリセット 1 を表示する
    #[serde(rename = "presetsEnabled")]
    pub(crate) presets_enabled: bool,
    /// いま選んでいるプリセット
    pub(crate) preset: u32,
    /// プリセットの数(1〜9)
    #[serde(rename = "presetCount")]
    pub(crate) preset_count: u32,
    /// フォルダを開いたモーダルの透過度(0-100、大きいほど透ける)
    #[serde(rename = "modalTransparency")]
    pub(crate) modal_transparency: u32,
    /// フォルダを開いたとき、背後をぼかす強さ(0-30px、0でぼかさない)
    #[serde(rename = "modalBlur")]
    pub(crate) modal_blur: u32,
    /// アイコンを長押ししてドラッグできるようになるまでの時間(ms)
    #[serde(rename = "dragDelayMs")]
    pub(crate) drag_delay_ms: u32,
    /// 別のアイコンに重ねて止めてから、フォルダを作れる(フォルダへ入れられる)状態になるまでの時間(ms)
    #[serde(rename = "mergeDelayMs")]
    pub(crate) merge_delay_ms: u32,
    /// 時刻と日付を表示するか
    #[serde(rename = "showClock")]
    pub(crate) show_clock: bool,
    /// ランチャーが出す音全体の音量(0-100。100 は、PC の音量設定のまま)
    #[serde(rename = "masterVolume")]
    pub(crate) master_volume: u32,
    /// ボタンなどにカーソルを合わせたときの説明(ツールチップ)を出すか
    #[serde(rename = "showTooltips")]
    pub(crate) show_tooltips: bool,
    /// 外部のサーバーと通信してよいと、利用者が同意したウィジェット・ミニアプリ("widget:<名前>" / "miniapp:<名前>" / "widget:<ミニアプリ>/<名前>")
    #[serde(rename = "networkAllowed")]
    pub(crate) network_allowed: Vec<String>,
    /// ヘッダー(上のウィジェット欄)を使うか
    #[serde(rename = "headerEnabled")]
    pub(crate) header_enabled: bool,
    /// フッター(下のウィジェット欄)を使うか
    #[serde(rename = "footerEnabled")]
    pub(crate) footer_enabled: bool,
    /// ヘッダーに並べるウィジェット("clock" / "memo" / "mod:<フォルダ名>")。None は以前の設定(showClock)から引き継ぐ
    #[serde(rename = "headerWidgets")]
    pub(crate) header_widgets: Option<Vec<String>>,
    /// フッターに並べるウィジェット
    #[serde(rename = "footerWidgets")]
    pub(crate) footer_widgets: Option<Vec<String>>,
    /// ウィジェットごとの大きさ(倍率。1.0 が標準)。キーはウィジェット ID
    #[serde(rename = "widgetScales")]
    pub(crate) widget_scales: HashMap<String, f64>,
    /// ウィジェットの置き場所。キーは "header:<ID>" / "footer:<ID>"、値は [開始のマス(1〜7), 幅(マスの数)]。
    /// ヘッダー・フッターは、横に 7 マスに区切られている(中心は 4)
    #[serde(rename = "widgetCells")]
    pub(crate) widget_cells: HashMap<String, [u32; 2]>,
    /// ヘッダーの高さ(縦のマスの数)。1(小)・2(標準)・3(大)。ヘッダーを右クリックして決める。ヘッダーのウィジェットは、すべて、この高さになる
    #[serde(rename = "headerRows")]
    pub(crate) header_rows: u32,
    /// フッターの高さ(縦のマスの数)。ヘッダーと同じ
    #[serde(rename = "footerRows")]
    pub(crate) footer_rows: u32,
    /// ウィジェットが保存するデータ(ToDo・付箋・タイマーなど)。キーはウィジェットごとの名前、値は JSON 文字列
    #[serde(rename = "widgetData")]
    pub(crate) widget_data: HashMap<String, String>,
}

impl Default for Settings {
    /// 設定の初期値(初めて起動したとき・「デフォルト値にする」のときの値)。
    fn default() -> Self {
        Self {
            width: 520.0,
            height: 720.0,
            theme: "gray".into(),
            custom_color: "#3b82f6".into(),
            ui_theme: "auto".into(),
            ui_color: "#3b82f6".into(),
            ui_transparency: 0,
            image_dim: 40,
            icon_size: 90,
            icon_gap: 18,
            bg_transparency: 22,
            home_layout_mode: "auto".into(),
            home_icon_count: 9,
            modal_layout_mode: "auto".into(),
            modal_icon_count: 9,
            hotkey_enabled: true,
            hotkey: DEFAULT_HOTKEY.into(),
            always_on_top: false,
            desktop_mode: false,
            presets_enabled: true,
            preset: 1,
            preset_count: 3,
            preview_thumbnails: true,
            modal_transparency: 12,
            modal_blur: 10,
            drag_delay_ms: 500,
            merge_delay_ms: 500,
            show_clock: true,
            master_volume: 100,
            show_tooltips: false,
            network_allowed: Vec::new(),
            header_enabled: true,
            footer_enabled: false,
            header_widgets: None,
            footer_widgets: None,
            widget_scales: HashMap::new(),
            widget_cells: HashMap::new(),
            header_rows: 2,
            footer_rows: 2,
            widget_data: HashMap::new(),
        }
    }
}

/// 設定ファイル(`config.json`)の全体。
/// プリセット 1 のフォルダ・並び順は `folders` / `orders` に(以前の形式のまま)、プリセット 2〜9 は `presets` に入る。
/// `usage`(起動の記録)は、ディスクには保存するが、画面には渡さない。
#[derive(Serialize, Deserialize, Clone, Default)]
pub(crate) struct Config {
    pub(crate) folders: Vec<FolderEntry>,
    #[serde(default)]
    pub(crate) orders: HashMap<String, Vec<String>>,
    #[serde(default)]
    pub(crate) settings: Settings,
    /// プリセット 2〜9 のフォルダと並び順(キーは "2"〜"9")。プリセット 1 は、上の folders / orders に入る(以前の形式のまま)
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub(crate) presets: HashMap<String, PresetData>,
    /// 起動の記録(パス → 回数と最後に起動した時刻)。「よく使うもの」「最近開いた」ウィジェットに使う。画面には渡さない
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub(crate) usage: HashMap<String, Usage>,
}

/// 1 つのファイルの起動の記録(「よく使うもの」「最近開いた」ウィジェット用)。
#[derive(Serialize, Deserialize, Clone, Default)]
pub(crate) struct Usage {
    pub(crate) count: u32,
    /// 最後に起動した時刻(UNIX 秒)
    pub(crate) last: u64,
}

/// 記録しておく起動履歴の上限(古いものから捨てる)
pub(crate) const MAX_USAGE: usize = 300;

/// プリセット 2〜9 の、フォルダの一覧と並び順。
#[derive(Serialize, Deserialize, Clone, Default)]
pub(crate) struct PresetData {
    #[serde(default)]
    pub(crate) folders: Vec<FolderEntry>,
    #[serde(default)]
    pub(crate) orders: HashMap<String, Vec<String>>,
}

/// いま表示するプリセット番号を求める。
///
/// # 引数
/// * `s` - 設定
///
/// # 戻り値
/// 1〜9 の番号。プリセットを使わない設定のときは、常に 1
pub(crate) fn active_preset(s: &Settings) -> u32 {
    if s.presets_enabled {
        s.preset.clamp(1, s.preset_count.clamp(1, 9))
    } else {
        1
    }
}

/// 画面に渡す設定を作る。いま表示するプリセットのフォルダ・並び順だけを入れ、他のプリセットや起動の記録は含めない。
///
/// # 引数
/// * `full` - 保存用の設定全体
///
/// # 戻り値
/// 画面用の設定(`folders` / `orders` が、表示中のプリセットのもの)
pub(crate) fn view_of(full: &Config) -> Config {
    let n = active_preset(&full.settings);
    let (folders, orders) = if n == 1 {
        (full.folders.clone(), full.orders.clone())
    } else {
        let p = full
            .presets
            .get(&n.to_string())
            .cloned()
            .unwrap_or_default();
        (p.folders, p.orders)
    };
    Config {
        folders,
        orders,
        settings: full.settings.clone(),
        presets: HashMap::new(),
        usage: HashMap::new(),
    }
}

/// 画面から届いた(表示中のプリセットの)フォルダ・並び順を、保存用の設定へ戻す。
///
/// # 引数
/// * `full` - 保存用の設定全体(ここを書き換える)
/// * `view` - 画面から届いた設定
pub(crate) fn store_view(full: &mut Config, view: Config) {
    let n = active_preset(&full.settings);
    if n == 1 {
        full.folders = view.folders;
        full.orders = view.orders;
    } else {
        full.presets.insert(
            n.to_string(),
            PresetData {
                folders: view.folders,
                orders: view.orders,
            },
        );
    }
}

/// 初めて起動したときの設定を作る。スタートメニューとデスクトップを、最初のフォルダとして登録する。
///
/// # 戻り値
/// 初期設定
pub(crate) fn default_config() -> Config {
    let mut folders = Vec::new();
    if let Ok(p) = std::env::var("ProgramData") {
        folders.push(FolderEntry {
            id: "startmenu".into(),
            name: if is_ja() {
                "スタートメニュー"
            } else {
                "Start Menu"
            }
            .into(),
            path: format!("{p}\\Microsoft\\Windows\\Start Menu\\Programs"),
        });
    }
    if let Ok(p) = std::env::var("USERPROFILE") {
        folders.push(FolderEntry {
            id: "desktop".into(),
            name: if is_ja() {
                "デスクトップ"
            } else {
                "Desktop"
            }
            .into(),
            path: format!("{p}\\Desktop"),
        });
    }
    Config {
        folders,
        orders: HashMap::new(),
        settings: Settings::default(),
        presets: HashMap::new(),
        usage: HashMap::new(),
    }
}
