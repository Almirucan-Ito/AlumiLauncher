//! Windows の表示言語の判定。

/// Windows の表示言語が日本語か調べる。トレイメニューの文言や、初期フォルダの名前を決めるのに使う。
///
/// # 戻り値
/// 日本語なら `true`(Windows 以外では常に `false`)
pub(crate) fn is_ja() -> bool {
    #[cfg(windows)]
    // SAFETY: 引数もポインタも取らず、呼ぶだけの関数。
    unsafe {
        (windows::Win32::Globalization::GetUserDefaultUILanguage() & 0x3ff) == 0x11
    }
    #[cfg(not(windows))]
    false
}
