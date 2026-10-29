//! 設定ファイルの場所(通常版・ポータブル版)と、読み込み・保存(遅延して書く)。

use crate::config::model::default_config;
use crate::config::model::Config;
use crate::config::sanitize::sanitize_config;
use crate::logging;
use crate::logging::LogErr;
use crate::state::AppState;
use crate::state::LockExt;
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::time::Duration;
use tauri::AppHandle;
use tauri::Emitter;
use tauri::Manager;

/// 設定ファイル(`config.json`)の場所を求める(データフォルダは、無ければ作る)。
///
/// # 引数
/// * `app` - アプリのハンドル
///
/// # 戻り値
/// `config.json` の絶対パス。データフォルダを作れなければエラーの理由
pub(crate) fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = data_dir(app).map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("config.json"))
}

/// ポータブル版かどうかを調べ、そうなら、データの置き場を返す。
/// exe と同じ場所に `portable.txt` があるとき、データの置き場は、exe の隣の `data` フォルダになる。
///
/// # 戻り値
/// ポータブル版なら `Some(<exe のフォルダ>\data)`。そうでなければ `None`(通常どおり `%AppData%\AlumiLauncher`)
pub fn portable_dir() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?;
    dir.join("portable.txt").is_file().then(|| dir.join("data"))
}

/// データの置き場(設定・ホーム・ミニアプリ・ウィジェットなど、すべてここ)を求める。
///
/// # 引数
/// * `app` - アプリのハンドル
///
/// # 戻り値
/// ポータブル版なら exe の隣の `data`、そうでなければ `%AppData%\AlumiLauncher`。作れなければエラーの理由
pub(crate) fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    if let Some(p) = portable_dir() {
        fs::create_dir_all(&p).map_err(|e| e.to_string())?;
        return Ok(p);
    }
    app.path().app_data_dir().map_err(|e| e.to_string())
}

/// 設定ファイルを読む。壊れていたら `config.json.bak` に退避して、初期設定で起動する(そのまま上書き保存して、利用者の設定を失わないため)。
/// 読めた設定は、`sanitize_config` で検査し、新しい項目を補う。
///
/// # 引数
/// * `app` - アプリのハンドル
///
/// # 戻り値
/// 設定(読めなければ初期設定)
pub(crate) fn load_config_file(app: &AppHandle) -> Config {
    let Ok(path) = config_path(app) else {
        return default_config();
    };
    let Ok(text) = fs::read_to_string(&path) else {
        return default_config();
    };
    match serde_json::from_str::<Config>(&text) {
        Ok(mut cfg) => {
            sanitize_config(&mut cfg); // 新しい項目(ウィジェットなど)の補完。古い設定ファイルには無い
            cfg
        }
        Err(e) => {
            logging::error(&format!(
                "設定ファイルが壊れていたため、config.json.bak に退避して初期設定で起動: {e}"
            ));
            fs::rename(&path, path.with_extension("json.bak")).log_err("設定ファイルの退避");
            default_config()
        }
    }
}

/// 設定をファイルへ書く。一時ファイルに書いてから置き換えるので、書き込み中に落ちても、設定ファイルが壊れない。
///
/// # 引数
/// * `app` - アプリのハンドル
/// * `cfg` - 保存する設定
///
/// # 戻り値
/// `Ok(())` または失敗の理由
pub(crate) fn write_config_file(app: &AppHandle, cfg: &Config) -> Result<(), String> {
    let path = config_path(app)?;
    let json = serde_json::to_string_pretty(cfg).map_err(|e| e.to_string())?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, json).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

/// メモリ上の設定のコピーを返す。
///
/// # 引数
/// * `app` - アプリのハンドル
///
/// # 戻り値
/// 設定のコピー
pub(crate) fn read_config(app: &AppHandle) -> Config {
    app.state::<AppState>().config.lock_ok().clone()
}

/// 保留中の変更(`dirty`)があれば、ディスクへ書き出す。終了・隠す・保存の予約から呼ばれる。
///
/// # 引数
/// * `app` - アプリのハンドル
pub(crate) fn flush_config(app: &AppHandle) {
    let state = app.state::<AppState>();
    if state.dirty.swap(false, Ordering::SeqCst) {
        let cfg = state.config.lock_ok().clone();
        // 書き込めなかったら、「保留中」に戻す(次に隠す・終了するときに、もう一度書く)。記録して、画面にも知らせる
        if let Err(e) = write_config_file(app, &cfg) {
            state.dirty.store(true, Ordering::SeqCst);
            logging::error(&format!("設定の保存に失敗: {e}"));
            let _ = app.emit("save-failed", e);
        }
    }
}

/// 設定の書き込みを予約する。連続して呼ばれても(ドラッグ中の並べ替えなど)、書き込みは 120ms にまとめる。
/// 短くしてあるのは、設定を変えてすぐ終了・再インストールされても、失わないため。
///
/// # 引数
/// * `app` - アプリのハンドル
pub(crate) fn schedule_flush(app: &AppHandle) {
    if !app.state::<AppState>().dirty.swap(true, Ordering::SeqCst) {
        let app = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(120));
            flush_config(&app);
        });
    }
}
