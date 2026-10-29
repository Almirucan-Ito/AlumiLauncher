//! 同梱のミニアプリ・ウィジェット(`build.rs` が作る一覧)を、起動時に書き出す処理。

use crate::extensions::catalog::miniapps_dir;
use crate::extensions::catalog::widgets_dir;
use crate::logging::LogErr;
use std::collections::HashSet;
use std::fs;
use std::path::Path;
use tauri::AppHandle;

/// 同梱するミニアプリ・ウィジェットの一覧と版。`build.rs` が、`src/miniapps` と `src/widgets` のフォルダから作る(フォルダを足すだけで同梱される)。
/// `(フォルダ名, [(ファイル名, 中身)])` の形で、実行ファイルの中に埋め込み、起動時に、フォルダが無いか、版が違うときに書き出す(`ensure_bundled_miniapps`)。
/// 版は、同梱するものの内容から作ったハッシュ(内容が変わると、次の起動で、書き換える。`data` フォルダの保存データは残る)。
pub(crate) mod generated {
    include!(concat!(env!("OUT_DIR"), "/bundled.rs"));
}

use generated::{BUNDLED_MINIAPPS, BUNDLED_VERSION, BUNDLED_WIDGETS, BUNDLED_WIDGETS_VERSION};

/// 同梱するミニアプリ全部を返す。
///
/// # 戻り値
/// `(フォルダ名, [(ファイル名, 中身)])` の一覧
pub(crate) fn bundled_miniapps(
) -> &'static [(&'static str, &'static [(&'static str, &'static str)])] {
    BUNDLED_MINIAPPS
}

/// 組み込みのミニアプリ・ウィジェットを書き出したときの「版の印」のファイル名。中身が今の版と同じなら、書き出し直さない。
pub(crate) const BUNDLED_MARK: &str = ".alumi-bundled";

/// 「一度書き出したことがある」組み込みのものの記録のファイル名(widgets / miniapps フォルダの直下)。
/// これを消すと、削除した組み込みのものが、次の起動で戻る
pub(crate) const SEEDED_FILE: &str = ".alumi-seeded";

/// 同梱のファイルを、フォルダへ書き出す(入れ子のフォルダ `widgets/music/...` も作る)。
///
/// # 引数
/// * `dir` - 書き出し先のフォルダ
/// * `files` - `(相対パス, 中身)` の一覧
///
/// # 戻り値
/// フォルダを作れたら `true`
pub(crate) fn write_bundled_files(dir: &Path, files: &[(&str, &str)]) -> bool {
    if fs::create_dir_all(dir)
        .log_err("同梱ファイルの書き出し先を作成")
        .is_none()
    {
        return false;
    }
    for (name, body) in files {
        let path = dir.join(name);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).log_err("同梱ファイルのフォルダを作成");
        }
        fs::write(&path, body).log_err(&format!("同梱ファイルの書き出し {}", path.display()));
    }
    true
}

/// 組み込みのミニアプリ 1 つを、書き出すか決める。
/// ・利用者が削除したもの(一度書き出したのに、フォルダが無い)は、作り直さない
/// ・フォルダが無いとき(初めて)、または、版の印が今と違うとき(古い版・印が無い)は、書き出す
/// ・同じ版なら、そのまま(自分で書き換えた内容を残す)
///
/// # 引数
/// * `dir` - 書き出し先のフォルダ
/// * `id` - 組み込みのものの名前(フォルダ名)
/// * `seeded` - 一度書き出したことがあるものの記録
/// * `version` - いまの版
///
/// # 戻り値
/// 書き出すなら `true`
pub(crate) fn should_write_bundled(
    dir: &Path,
    id: &str,
    seeded: &HashSet<String>,
    version: &str,
) -> bool {
    if !dir.exists() && seeded.contains(id) {
        return false;
    }
    !fs::read_to_string(dir.join(BUNDLED_MARK))
        .map(|s| s.trim() == version)
        .unwrap_or(false)
}

/// 一度書き出したことがある組み込みのもの(フォルダ名)の記録を読む。
///
/// # 引数
/// * `root` - widgets または miniapps フォルダ
///
/// # 戻り値
/// フォルダ名の集合。記録が無ければ空
pub(crate) fn read_seeded(root: &Path) -> HashSet<String> {
    fs::read_to_string(root.join(SEEDED_FILE))
        .map(|s| {
            s.lines()
                .map(|l| l.trim().to_string())
                .filter(|l| !l.is_empty())
                .collect()
        })
        .unwrap_or_default()
}

/// 一度書き出したことがある組み込みのものの記録を、書き込む(1 行に 1 つ)。
///
/// # 引数
/// * `root` - widgets または miniapps フォルダ
/// * `ids` - 記録するフォルダ名
pub(crate) fn write_seeded(root: &Path, ids: &HashSet<String>) {
    let mut v: Vec<&String> = ids.iter().collect();
    v.sort();
    fs::write(
        root.join(SEEDED_FILE),
        v.iter().map(|s| s.as_str()).collect::<Vec<_>>().join("\n"),
    )
    .log_err("書き出し済みの記録の保存");
}

/// 組み込みウィジェットの定義を、widgets フォルダへ書き出す。版の印(`widgets\.alumi-bundled`)が今と同じなら、何もしない(自分で消したり書き換えたりしたものを、起動のたびに戻さない)。
/// なくなったウィジェット(以前の版が書き出したミュージック・付箋の定義)は、ここで消す。
///
/// # 引数
/// * `app` - アプリのハンドル
pub(crate) fn ensure_bundled_widgets(app: &AppHandle) {
    let Some(root) = widgets_dir(app) else { return };
    if fs::read_to_string(root.join(BUNDLED_MARK))
        .map(|s| s.trim() == BUNDLED_WIDGETS_VERSION)
        .unwrap_or(false)
    {
        return;
    }
    // ミュージックのウィジェットの定義は、ミニアプリ「ミュージック」の中(miniapps\music\widgets)へ移した。以前の版が書き出した、widgets フォルダの分は消す
    let old_music = root.join("music");
    if fs::read_to_string(old_music.join("widget.json"))
        .map(|s| s.contains(r#""builtin":"music""#))
        .unwrap_or(false)
    {
        let _ = fs::remove_dir_all(&old_music);
    }
    // 付箋のウィジェットは、なくした。以前の版が書き出した、組み込みの定義だけを消す(自分で作ったものは消さない)
    let old_sticky = root.join("sticky");
    if fs::read_to_string(old_sticky.join("widget.json"))
        .map(|s| s.contains(r#""builtin":"sticky""#))
        .unwrap_or(false)
    {
        let _ = fs::remove_dir_all(&old_sticky);
    }
    // 利用者が削除したもの(一度書き出したのに、フォルダが無い)は、版が変わっても、作り直さない
    let mut seeded = read_seeded(&root);
    for &(id, files) in BUNDLED_WIDGETS {
        let dir = root.join(id);
        if !dir.exists() && seeded.contains(id) {
            continue;
        }
        if write_bundled_files(&dir, files) {
            seeded.insert(id.to_string());
        }
    }
    write_seeded(&root, &seeded);
    fs::write(root.join(BUNDLED_MARK), BUNDLED_WIDGETS_VERSION)
        .log_err("ウィジェットの版の印の保存");
}

/// 組み込みのミニアプリを、miniapps フォルダへ書き出す。フォルダが無いか、版の印が今と違うときだけ書き出す(同じ版なら、自分で書き換えた内容を残す)。
///
/// # 引数
/// * `app` - アプリのハンドル
pub(crate) fn ensure_bundled_miniapps(app: &AppHandle) {
    let Some(root) = miniapps_dir(app) else {
        return;
    };
    // 一度書き出したことがあるものの記録。利用者が削除したものを、起動のたびに作り直さないために使う
    let mut seeded = read_seeded(&root);
    let seeded_before = seeded.clone();
    for &(id, files) in bundled_miniapps() {
        let dir = root.join(id);
        if !should_write_bundled(&dir, id, &seeded, BUNDLED_VERSION) {
            continue;
        }
        seeded.insert(id.to_string());
        if write_bundled_files(&dir, files) {
            fs::write(dir.join(BUNDLED_MARK), BUNDLED_VERSION).log_err("ミニアプリの版の印の保存");
        }
    }
    if seeded != seeded_before {
        write_seeded(&root, &seeded);
    }
}
