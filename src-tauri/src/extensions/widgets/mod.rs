//! 追加ウィジェット(Mod)とミニアプリ。
//!
//! - ウィジェット: `%AppData%\AlumiLauncher\widgets\<id>\widget.json` と `index.html` などを置くだけで使える。
//! - ミニアプリ: `%AppData%\AlumiLauncher\miniapps\<id>\miniapp.json` と `index.html` などを置くと、ランチャーの中で
//!   全画面のアプリとして動く。ミニアプリのフォルダの中に `widgets\<id>\widget.json` があれば、それもウィジェットとして使える。
//!
//! 画面側は `widget` / `miniapp` プロトコルで、それぞれのフォルダのファイルだけを読み込む(sandbox 付きの iframe)。
//! どちらも、ランチャーの機能・設定・ファイルには直接触れない(許可した機能だけ、postMessage の窓口から使える)。
//! 外部との通信は、manifest に `"network": true` と宣言したものだけが対象で、利用者が初めて使うときに同意したあとだけ、できる(CSP の connect-src で制限)。
//! 宣言のないもの、同意していないものは、通信できない。

use std::fs;
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};

mod icons;
mod install;
mod paths;
mod protocol;
mod scan;
#[cfg(test)]
mod tests;

// 小さなファイルに分けた中身を、これまでどおり `widgets::名前` で使えるようにする(中のファイルどうしも、これで呼び合う)
pub(crate) use icons::*;
pub(crate) use install::*;
pub(crate) use paths::*;
pub(crate) use protocol::*;
pub(crate) use scan::*;

/// 1 つのファイルの大きさの上限(バイト)
const MAX_FILE: u64 = 8 * 1024 * 1024;

/// 一覧に出す数の上限
const MAX_WIDGETS: usize = 64;

/// 一覧に出すミニアプリの数の上限。
const MAX_MINIAPPS: usize = 64;

/// `widget.json` / `miniapp.json` の中身(マニフェスト)。書かれていない項目は、空・0・false になる。
/// ウィジェットとミニアプリで、同じ形を使う(それぞれ、使わない項目は無視する)。
#[derive(Deserialize, Default)]
#[serde(default)]
pub(crate) struct Manifest {
    name: String,
    description: String,
    /// 最初に開くファイル(省略時は index.html)
    entry: String,
    /// アイコンの画像(フォルダ内。png / svg / jpg / webp / gif)
    icon: String,
    /// ウィジェット: 表示する高さ(px)
    height: u32,
    /// ウィジェット: 幅(px)。省略時は 160
    width: u32,
    /// 組み込みのウィジェット(clock など)の定義。指定すると、中身(index.html)は使わず、ランチャーが持つ同名の実装を使う
    builtin: String,
    /// データを、別のミニアプリと共有するとき、そのミニアプリのフォルダ名(ToDo ウィジェットの "planner" など)。一覧のデータ・キャッシュの操作は、そちらに対して行う
    data_app: String,
    /// 英語表示のときの名前・説明(省略時は、name / description)
    name_en: String,
    description_en: String,
    /// 幅の範囲と標準([最小, 最大, 標準]。マスの数)
    cells: Option<[u32; 3]>,
    /// ミニアプリ: 使いたい機能(使える名前は、`schemas/miniapp.schema.json` の permissions)
    permissions: Vec<String>,
    /// ミニアプリ: Web サイトを、ランチャーの中の別の画面(WebView)で開く(https のみ)。指定すると entry は使わない
    url: String,
    /// Web ミニアプリ: true にすると、パソコンではなくスマホのブラウザとして開く(既定はパソコン)
    mobile: bool,
    /// 外部のサーバーと通信するか。true と書いたものだけが、通信できる(初めて使うときに、利用者の同意が要る)
    network: bool,
}

/// 画面(フロント)へ返す、ウィジェット 1 つぶんの情報。マニフェストを検査・丸めた結果(名前は 40 字、説明は 200 字までなど)。
#[derive(Serialize, Debug, PartialEq)]
pub struct WidgetInfo {
    /// フォルダ名
    pub id: String,
    pub name: String,
    pub description: String,
    pub entry: String,
    pub icon: String,
    pub width: u32,
    pub height: u32,
    /// 組み込みのウィジェットの種類("clock" など)。追加ウィジェットでは空
    pub builtin: String,
    /// データを共有するミニアプリのフォルダ名(無ければ空)
    #[serde(rename = "dataApp")]
    pub data_app: String,
    #[serde(rename = "nameEn")]
    pub name_en: String,
    #[serde(rename = "descriptionEn")]
    pub description_en: String,
    /// 幅の範囲と標準([最小, 最大, 標準]。マスの数)。決まっていなければ [0, 0, 0]
    pub cells: [u32; 3],
    /// 外部のサーバーと通信すると宣言しているか(宣言していないものは、通信できない)
    pub network: bool,
    /// "mod"(widgets フォルダ)か "mini"(ミニアプリの中のウィジェット)
    pub kind: String,
    /// kind が "mini" のとき、持ち主のミニアプリのフォルダ名と名前
    pub app: String,
    #[serde(rename = "appName")]
    pub app_name: String,
    /// kind が "mini" のとき、持ち主のミニアプリの、英語表示のときの名前(無ければ空)
    #[serde(rename = "appNameEn")]
    pub app_name_en: String,
}

/// 画面(フロント)へ返す、ミニアプリ 1 つぶんの情報。マニフェストを検査した結果(知らない権限は捨てる)。
#[derive(Serialize, Debug, PartialEq)]
pub struct MiniAppInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    /// 英語表示のときの名前・説明(無ければ空。画面側が、無ければ、name / description を使う)
    #[serde(rename = "nameEn")]
    pub name_en: String,
    #[serde(rename = "descriptionEn")]
    pub description_en: String,
    pub entry: String,
    pub icon: String,
    pub permissions: Vec<String>,
    /// Web サイトを開くミニアプリのとき、その URL(https)。普通のミニアプリでは空
    pub url: String,
    /// Web ミニアプリを、スマホのブラウザとして開くか(既定はパソコン)
    pub mobile: bool,
    /// 外部のサーバーと通信するか(Web サイトを開くものは、常に true)。初めて使うときに、利用者の同意が要る
    pub network: bool,
}
