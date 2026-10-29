//! Windows のシェルの機能(アイコン・ドラッグ・ショートカット・スタートメニュー)。

pub(crate) mod commands;
#[cfg(windows)]
pub(crate) mod dragout;
#[cfg(windows)]
pub(crate) mod icon;
pub(crate) mod locale;
pub(crate) mod shortcut;
pub(crate) mod startmenu;
