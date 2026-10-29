//! 起動(`launch`)と、起動の記録(よく使うもの・最近開いたもの)。

use crate::config::model::Usage;
use crate::config::model::MAX_USAGE;
use crate::config::store::schedule_flush;
use crate::files::listing::Item;
use crate::files::roots::in_registered;
use crate::state::AppState;
use crate::state::LockExt;
use std::collections::HashMap;
use std::path::Path;
use tauri::AppHandle;
use tauri::Manager;

/// 起動の記録を残す(回数 +1・最後の時刻)。書き込みは、少し待ってまとめて行う。
///
/// # 引数
/// * `app` - アプリのハンドル
/// * `path` - 起動したファイルのパス
pub(crate) fn record_usage(app: &AppHandle, path: &str) {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    {
        let state = app.state::<AppState>();
        let mut cfg = state.config.lock_ok();
        bump_usage(&mut cfg.usage, path, now);
    }
    schedule_flush(app);
}

/// 起動の記録を更新する。回数を +1 して時刻を入れ、`MAX_USAGE` 件を超えたら、古いものから捨てる。
///
/// # 引数
/// * `usage` - 記録(ここを書き換える)
/// * `path` - 起動したファイル
/// * `now` - いまの時刻(UNIX 秒)
pub(crate) fn bump_usage(usage: &mut HashMap<String, Usage>, path: &str, now: u64) {
    let e = usage.entry(path.to_string()).or_default();
    e.count = e.count.saturating_add(1);
    e.last = now;
    while usage.len() > MAX_USAGE {
        let Some(oldest) = usage
            .iter()
            .min_by_key(|(_, u)| u.last)
            .map(|(k, _)| k.clone())
        else {
            break;
        };
        usage.remove(&oldest);
    }
}

/// 起動の記録から、上位の、いまも存在するファイルを選ぶ。
///
/// # 引数
/// * `usage` - 記録
/// * `frequent` - `true` なら起動回数の多い順(同数なら新しい順)、`false` なら新しい順
/// * `n` - 取り出す件数
///
/// # 戻り値
/// アイコンの一覧(最大 `n` 件)
pub(crate) fn top_usage(usage: &HashMap<String, Usage>, frequent: bool, n: usize) -> Vec<Item> {
    let mut v: Vec<(&String, &Usage)> = usage
        .iter()
        .filter(|(p, _)| Path::new(p.as_str()).exists())
        .collect();
    if frequent {
        v.sort_by(|a, b| b.1.count.cmp(&a.1.count).then(b.1.last.cmp(&a.1.last)));
    } else {
        v.sort_by_key(|(_, e)| std::cmp::Reverse(e.last));
    }
    v.into_iter()
        .take(n)
        .map(|(p, _)| Item {
            name: Path::new(p)
                .file_name()
                .map(|s| s.to_string_lossy().into_owned())
                .unwrap_or_else(|| p.clone()),
            path: p.clone(),
        })
        .collect()
}

/// (コマンド)「よく使うもの」/「最近開いた」ウィジェット用の一覧(上位 5 件)を返す。
///
/// # 引数
/// * `kind` - `"frequent"`(よく使う順)か、それ以外(最近の順)
#[tauri::command]
pub async fn list_usage(app: AppHandle, kind: String) -> Vec<Item> {
    // 起動の記録だけをコピーして、ロックを手放してから調べる(`top_usage` は、ファイルが実在するかを 1 つずつ調べるので、
    // ロックしたまま行うと、その間、設定の保存などが待たされる)
    let usage = app.state::<AppState>().config.lock_ok().usage.clone();
    top_usage(&usage, kind == "frequent", 5)
}

/// (コマンド)ファイルを起動する。エクスプローラーのダブルクリックと同じ動作で開く(.lnk / .exe / .url など)。登録済みフォルダの中のファイルだけ起動できる(任意のプログラムや URL を、画面側から実行されないように)。
/// 起動したら、起動の記録を残す。
///
/// # 引数
/// * `path` - 起動するファイル
#[tauri::command]
pub async fn launch(app: AppHandle, path: String) -> Result<(), String> {
    // 登録済みフォルダ内のファイルだけを起動できる(任意のプログラムやURLを画面側から実行されないように)
    if !in_registered(&app, &path, false) {
        return Err("not_registered".into());
    }
    record_usage(&app, &path);
    // エクスプローラーのダブルクリックと同じ動作で開く(.lnk / .exe / .url など全部OK)
    let mut cmd = std::process::Command::new("explorer.exe");
    cmd.arg(&path);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    cmd.spawn().map(|_| ()).map_err(|e| e.to_string())
}
