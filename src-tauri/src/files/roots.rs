//! 操作してよいフォルダ(登録フォルダと launcherFolder)の管理と、その見張り(変更を画面へ知らせる)。

use crate::config::model::view_of;
use crate::extensions::catalog::miniapps_dir;
use crate::files::listing::launcher_dir;
use crate::state::AppState;
use crate::state::LockExt;
use std::collections::HashSet;
use std::fs;
use std::path::Path;
use std::path::PathBuf;
use std::time::Duration;
use tauri::AppHandle;
use tauri::Manager;

/// パスを比較用の形にする(小文字・`/` を `\` にそろえ、末尾の `\` を除く)。Windows は大文字・小文字を区別しないため。
///
/// # 引数
/// * `s` - パスの文字列
///
/// # 戻り値
/// 比較用に整えたパス
pub(crate) fn norm_path(s: &str) -> String {
    s.to_lowercase()
        .replace('/', "\\")
        .trim_end_matches('\\')
        .to_string()
}

/// 見張りが見つけた変化。
#[derive(Debug, PartialEq, Eq)]
pub(crate) enum WatchEvent {
    /// 登録フォルダ(か、ホームのアイコンの保存先)の中身が変わった(そのフォルダのパス)
    Folder(String),
    /// ミニアプリのフォルダが、増えた・減った(エクスプローラーでの削除・コピーなど)
    Miniapps,
}

/// 変わったパスが、どの見張りに当たるかを調べる。
///
/// # 引数
/// * `roots` - 見張っている登録フォルダ(`(比較用のパス, 元のパス)`)。その中のどこが変わっても当たる
/// * `shallow` - ミニアプリのフォルダ(比較用のパス)。直下の増減だけが当たる(中のデータ・キャッシュの書き込みでは、当たらない)
/// * `changed` - 変わったパス(比較用の形)
///
/// # 戻り値
/// 当たった見張りの種類。当たらなければ `None`(`\` を付けて比べるので、`C:\a` が `C:\ab` に誤って当たらない)
pub(crate) fn classify_change(
    roots: &[(String, String)],
    shallow: &[String],
    changed: &str,
) -> Option<WatchEvent> {
    if let Some((_, orig)) = roots
        .iter()
        .find(|(r, _)| changed == *r || changed.starts_with(&format!("{r}\\")))
    {
        return Some(WatchEvent::Folder(orig.clone()));
    }
    let direct = shallow.iter().any(|s| {
        changed == *s
            || changed
                .strip_prefix(&format!("{s}\\"))
                .is_some_and(|rest| !rest.is_empty() && !rest.contains('\\'))
    });
    direct.then_some(WatchEvent::Miniapps)
}

/// 登録フォルダ(とホームのアイコンの保存先)の中身が変わったら、画面へ知らせる見張りを作り直す。
/// エクスプローラーでの追加・削除・名前変更が、すぐ画面に出る。見張るパスが前と同じなら、何もしない(並べ替えのたびに作り直さないため)。
/// ミニアプリのフォルダは、直下だけを見張る(ミニアプリのデータ・キャッシュは、中で頻繁に書き換わるため)。
///
/// # 引数
/// * `app` - アプリのハンドル
/// * `paths` - 見張るフォルダのパスの一覧(中も見張る)
/// * `shallow` - 見張るフォルダのパスの一覧(直下だけ見張る)
pub(crate) fn restart_watcher(app: &AppHandle, paths: Vec<String>, shallow: Vec<String>) {
    use notify::{EventKind, RecursiveMode, Watcher};
    let state = app.state::<AppState>();
    let mut slot = state.watcher.lock_ok();
    if slot
        .as_ref()
        .map(|(old, old_shallow, _)| *old == paths && *old_shallow == shallow)
        .unwrap_or(false)
    {
        return;
    }
    *slot = None;
    let Some(tx) = state.watch_tx.lock_ok().clone() else {
        return;
    };
    let roots: Vec<(String, String)> = paths.iter().map(|p| (norm_path(p), p.clone())).collect();
    let shallow_norm: Vec<String> = shallow.iter().map(|p| norm_path(p)).collect();
    let Ok(mut watcher) = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        let Ok(ev) = res else { return };
        if matches!(ev.kind, EventKind::Access(_)) {
            return; // 読み取っただけの変化は、画面に関係ない
        }
        for p in &ev.paths {
            let np = norm_path(&p.to_string_lossy());
            if let Some(change) = classify_change(&roots, &shallow_norm, &np) {
                let _ = tx.send(change);
            }
        }
    }) else {
        return;
    };
    for p in &paths {
        let _ = watcher.watch(Path::new(p), RecursiveMode::Recursive);
    }
    for p in &shallow {
        let _ = watcher.watch(Path::new(p), RecursiveMode::NonRecursive);
    }
    *slot = Some((paths, shallow, watcher));
}

/// 見張りからの知らせを受けるスレッドを始める。知らせを最大 2 秒(250ms 静かになるまで)ためて、まとめて画面へ送る(登録フォルダは `folder-changed`、ミニアプリのフォルダは `miniapps-changed` イベント)。
/// ファイルを大量に動かしたときに、画面を何度も作り直さないため。
///
/// # 引数
/// * `app` - アプリのハンドル
pub(crate) fn spawn_watch_debouncer(app: &AppHandle) {
    use tauri::Emitter;
    let (tx, rx) = std::sync::mpsc::channel::<WatchEvent>();
    *app.state::<AppState>().watch_tx.lock_ok() = Some(tx);
    let app = app.clone();
    std::thread::spawn(move || {
        while let Ok(first) = rx.recv() {
            let mut folders: HashSet<String> = HashSet::new();
            let mut miniapps = false;
            let mut take = |ev: WatchEvent| match ev {
                WatchEvent::Folder(p) => {
                    folders.insert(p);
                }
                WatchEvent::Miniapps => miniapps = true,
            };
            take(first);
            let started = std::time::Instant::now();
            while started.elapsed() < Duration::from_secs(2) {
                match rx.recv_timeout(Duration::from_millis(250)) {
                    Ok(ev) => take(ev),
                    Err(_) => break,
                }
            }
            for p in folders {
                let _ = app.emit("folder-changed", p);
            }
            if miniapps {
                let _ = app.emit("miniapps-changed", ());
            }
        }
    });
}

/// 操作してよいフォルダの一覧(正規化済みパス)を作り直し、見張りも更新する。
/// 登録フォルダと、ホームのアイコンの保存先(launcherFolder)が対象。フォルダを登録・削除したときや、ウィンドウを出すときに呼ぶ。
///
/// # 引数
/// * `app` - アプリのハンドル
pub(crate) fn refresh_roots(app: &AppHandle) {
    let state = app.state::<AppState>();
    let mut roots: Vec<PathBuf> = view_of(&state.config.lock_ok())
        .folders
        .iter()
        .filter_map(|f| fs::canonicalize(&f.path).ok())
        .collect();
    // ホームに直接並べるショートカットの保存先(launcherFolder)も、登録済みとして扱う
    if let Some(dir) = launcher_dir(app) {
        let _ = fs::create_dir_all(&dir);
        if let Ok(c) = fs::canonicalize(&dir) {
            roots.push(c);
        }
    }
    *state.roots.lock_ok() = roots;

    // 見張るフォルダ: 登録したフォルダと、ホームのアイコンの保存先
    let mut watch: Vec<String> = view_of(&state.config.lock_ok())
        .folders
        .iter()
        .map(|f| f.path.clone())
        .collect();
    if let Some(dir) = launcher_dir(app) {
        watch.push(dir.to_string_lossy().into_owned());
    }
    // ミニアプリのフォルダは、直下の増減だけ見張る(消されたら、画面の一覧から外すため)
    let shallow: Vec<String> = miniapps_dir(app)
        .filter(|d| d.is_dir())
        .map(|d| d.to_string_lossy().into_owned())
        .into_iter()
        .collect();
    restart_watcher(app, watch, shallow);
}

/// 登録してよいフォルダか調べる。ドライブ直下や Windows フォルダは、起動・削除の対象が広くなりすぎるため登録させない。
///
/// # 引数
/// * `path` - 調べるフォルダのパス
///
/// # 戻り値
/// 登録してよければ `true`(存在しない・フォルダでない場合は `false`)
pub(crate) fn is_allowed_folder(path: &str) -> bool {
    let Ok(p) = fs::canonicalize(path) else {
        return false;
    };
    if !p.is_dir() {
        return false;
    }
    // ドライブ直下(例: C:\)は不可。canonicalize 後は「\\?\C:\」= プレフィックス + ルートの2要素
    if p.components().count() <= 2 {
        return false;
    }
    for var in ["SystemRoot", "windir"] {
        if let Ok(win) = std::env::var(var) {
            if let Ok(win) = fs::canonicalize(win) {
                if p.starts_with(&win) {
                    return false;
                }
            }
        }
    }
    true
}

/// パスが、登録済みフォルダの中にあるか調べる。画面側から、任意のパスを実行・削除・読み取りされないための検査(リンクを使った抜け道も、正規化して防ぐ)。
///
/// # 引数
/// * `app` - アプリのハンドル
/// * `path` - 調べるパス
/// * `allow_root` - `true` なら、登録フォルダ自身も許す。`false` なら、その中のものだけ
///
/// # 戻り値
/// 登録済みフォルダの中なら `true`(存在しないパスは `false`)
pub(crate) fn in_registered(app: &AppHandle, path: &str, allow_root: bool) -> bool {
    let Ok(target) = fs::canonicalize(path) else {
        return false;
    };
    app.state::<AppState>()
        .roots
        .lock_ok()
        .iter()
        .any(|dir| target.starts_with(dir) && (allow_root || target != *dir))
}
