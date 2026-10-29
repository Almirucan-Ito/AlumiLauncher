//! ミニアプリ・ウィジェット(マニフェスト・同梱・データ・Web ミニアプリ・音楽/画像の登録)。

#[cfg(windows)]
pub(crate) mod appdata;
pub(crate) mod bundled;
pub(crate) mod catalog;
pub(crate) mod media;
pub(crate) mod mini_web;
pub(crate) mod music;
pub(crate) mod storage;
pub(crate) mod widgets;
