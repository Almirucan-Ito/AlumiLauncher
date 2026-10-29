//! アプリ本体(Rust)のテスト。機能ごとのファイルに分けてある。

mod config;
mod extensions;
mod files;
mod window;

use crate::config::model::FolderEntry;

pub(super) fn folder(id: &str, path: &str) -> FolderEntry {
    FolderEntry {
        id: id.into(),
        name: "n".into(),
        path: path.into(),
    }
}
