//! 記録(ログ)。データフォルダの `logs\alumi.log` に、失敗やパニックを書き残す。
//!
//! 記録は、この PC の中だけに置く(どこにも送らない)。大きくなりすぎないよう、256KB を超えたら `alumi.log.old` に交代する(古い 1 世代だけ残す)。
//! 交代できなかったときも、大きくなり続けないよう、中身を空にする。そのため、`logs` フォルダ全体は、いつも約 0.5MB(256KB × 2)以下に収まる。
//! 記録そのものの失敗は、画面にも出さない(記録のための記録は作らない)。

use std::fmt::Display;
use std::fs;
use std::io::Write;
use std::path::Path;
use std::path::PathBuf;
use std::sync::Mutex;
use std::sync::OnceLock;
use std::time::SystemTime;
use std::time::UNIX_EPOCH;

/// 記録ファイルの大きさの上限(これを超えたら交代する)。古い 1 世代と合わせて、約 2 倍まで。
const MAX_LOG_BYTES: u64 = 256 * 1024;
/// 1 件の記録の長さの上限(画面から届く文字列の暴走を防ぐ)
const MAX_LINE_CHARS: usize = 2000;

/// 記録ファイルの場所(`init` で決まる)
static LOG_PATH: OnceLock<PathBuf> = OnceLock::new();
/// 書き込みを 1 つずつにするための鍵
static WRITE_LOCK: Mutex<()> = Mutex::new(());

/// 記録を始める。パニックも記録するようにする。
///
/// # 引数
/// * `data_dir` - データフォルダ(この下の `logs` に書く)
pub(crate) fn init(data_dir: &Path) {
    let dir = data_dir.join("logs");
    if fs::create_dir_all(&dir).is_err() {
        return;
    }
    let _ = LOG_PATH.set(dir.join("alumi.log"));
    let previous = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        write("PANIC", &info.to_string());
        previous(info);
    }));
    write("INFO", &format!("起動 v{}", env!("CARGO_PKG_VERSION")));
}

/// 1 件、記録する。
///
/// # 引数
/// * `level` - 重さ(`INFO` / `WARN` / `ERROR` / `PANIC`)
/// * `message` - 内容(長すぎれば切る。改行は 1 行にまとめる)
pub(crate) fn write(level: &str, message: &str) {
    let Some(path) = LOG_PATH.get() else {
        return;
    };
    let Ok(_guard) = WRITE_LOCK.lock() else {
        return;
    };
    rotate_if_needed(path, MAX_LOG_BYTES);
    let one_line: String = message
        .chars()
        .map(|c| if c == '\n' || c == '\r' { ' ' } else { c })
        .take(MAX_LINE_CHARS)
        .collect();
    if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(f, "{} {:<5} {}", timestamp(), level, one_line);
    }
}

/// 記録ファイルが `max` バイトを超えていたら、`.log.old` に交代する(前の `.old` は上書きされる)。
/// 交代できないとき(`.old` を開いている、など)は、大きくなり続けないよう、中身を空にする。
///
/// # 引数
/// * `path` - 記録ファイル(`alumi.log`)
/// * `max` - 大きさの上限(バイト)
fn rotate_if_needed(path: &Path, max: u64) {
    if fs::metadata(path).map(|m| m.len()).unwrap_or(0) <= max {
        return;
    }
    if fs::rename(path, path.with_extension("log.old")).is_err() {
        let _ = fs::write(path, b"");
    }
}

/// 失敗を記録する。
pub(crate) fn error(message: &str) {
    write("ERROR", message);
}

/// 失敗しても処理は続けるが、原因は残したい箇所に使う(`let _ =` の代わり)。
pub(crate) trait LogErr<T> {
    /// 失敗なら、`context` と原因を記録して `None` を返す。
    ///
    /// # 引数
    /// * `context` - 何をしようとしたか
    fn log_err(self, context: &str) -> Option<T>;
}

impl<T, E: Display> LogErr<T> for Result<T, E> {
    fn log_err(self, context: &str) -> Option<T> {
        match self {
            Ok(v) => Some(v),
            Err(e) => {
                error(&format!("{context}: {e}"));
                None
            }
        }
    }
}

/// 日時を `2026-10-26 12:34:56`(UTC)の形にする。外部のライブラリを使わず、日数から年月日を求める。
fn timestamp() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let (days, rem) = ((secs / 86_400) as i64, secs % 86_400);
    let (y, m, d) = civil_from_days(days);
    format!(
        "{y:04}-{m:02}-{d:02} {:02}:{:02}:{:02}Z",
        rem / 3600,
        rem % 3600 / 60,
        rem % 60
    )
}

/// 1970-01-01 からの日数を、年月日にする(Howard Hinnant の方法)。
fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    let y = yoe + era * 400 + i64::from(m <= 2);
    (y, m, d)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn civil_dates() {
        assert_eq!(civil_from_days(0), (1970, 1, 1));
        assert_eq!(civil_from_days(20_752), (2026, 10, 26));
        assert_eq!(civil_from_days(11_016), (2000, 2, 29));
    }

    #[test]
    fn a_big_log_is_swapped_for_a_fresh_one_and_only_one_old_copy_is_kept() {
        let dir = std::env::temp_dir().join(format!("alumi-log-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let log = dir.join("alumi.log");
        let old = dir.join("alumi.log.old");
        // 上限以下なら、何もしない
        fs::write(&log, vec![b'a'; 100]).unwrap();
        rotate_if_needed(&log, 100);
        assert!(log.exists() && !old.exists());
        // 上限を超えたら、.old に交代する(前の .old は上書き)
        fs::write(&old, b"previous").unwrap();
        fs::write(&log, vec![b'b'; 101]).unwrap();
        rotate_if_needed(&log, 100);
        assert!(!log.exists(), "新しい記録は、次の書き込みで作られる");
        assert_eq!(fs::metadata(&old).unwrap().len(), 101);
        // 交代できない(.old の場所がフォルダで、上書きできない)ときも、大きくならないよう、空にする
        fs::remove_file(&old).unwrap();
        fs::create_dir(&old).unwrap();
        fs::write(&log, vec![b'c'; 101]).unwrap();
        rotate_if_needed(&log, 100);
        assert_eq!(fs::metadata(&log).unwrap().len(), 0);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn log_err_returns_none_on_error() {
        let r: Result<u8, String> = Err("x".into());
        assert_eq!(r.log_err("test"), None);
        let ok: Result<u8, String> = Ok(3);
        assert_eq!(ok.log_err("test"), Some(3));
    }
}
