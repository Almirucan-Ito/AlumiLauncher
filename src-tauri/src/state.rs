//! アプリ全体で共有する状態(`AppState`)。

use crate::config::model::Config;
use crate::extensions::music;
use crate::window::hotkey::HotkeySpec;
use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::Mutex;
use std::sync::MutexGuard;

/// アプリ全体で共有する状態。設定はメモリ上に持ち(画面からの保存で即時更新)、ディスクへの書き込みはまとめて遅延させる(`schedule_flush`)。
#[derive(Default)]
pub(crate) struct AppState {
    pub(crate) config: Mutex<Config>,
    pub(crate) dirty: AtomicBool,
    /// 画面(フロント)が、起動時のアイコンの用意まで終えたか。終えるまで、ウィンドウは出さない(アイコンの表示が乱れないように)
    pub(crate) ready: AtomicBool,
    /// 画面が用意できたら、ウィンドウを出す(起動時や、用意前にショートカットなどで呼ばれたとき)
    pub(crate) want_show: AtomicBool,
    /// 操作してよいフォルダ(登録済みフォルダと launcherFolder)の正規化済みパス。
    /// アイコン1つごとに全フォルダを調べ直さなくて済むよう、設定の保存時などに作り直す
    pub(crate) roots: Mutex<Vec<PathBuf>>,
    /// 今登録しているショートカット(設定の `hotkey` を読んだもの)
    pub(crate) hotkey: Mutex<Option<HotkeySpec>>,
    /// フォルダの中身の変化を見張るもの(見張っているパスの一覧と一緒に持つ)
    pub(crate) watcher: Mutex<Option<(Vec<String>, notify::RecommendedWatcher)>>,
    /// 見張りから、まとめ役のスレッドへ「このフォルダが変わった」と伝える口
    pub(crate) watch_tx: Mutex<Option<std::sync::mpsc::Sender<String>>>,
    /// 音楽プレーヤーに登録した音声ファイル(印 → パス)
    pub(crate) music: Mutex<music::Registry>,
}

/// `Mutex` のロックを取る(`.lock().unwrap()` の代わり)。別のスレッドがロックを持ったまま落ちると、ロックは「毒化」して、
/// `unwrap()` では、アプリごと落ちてしまう。ここでは、毒化していても、中身を取り出して、続ける
/// (中身は、書き換えの途中でも、このアプリでは、使えなくなるほど壊れる作りではない)。
pub(crate) trait LockExt<T> {
    /// ロックを取る。毒化していても、中身を取り出す。
    fn lock_ok(&self) -> MutexGuard<'_, T>;
}

impl<T> LockExt<T> for Mutex<T> {
    fn lock_ok(&self) -> MutexGuard<'_, T> {
        self.lock().unwrap_or_else(|e| e.into_inner())
    }
}
