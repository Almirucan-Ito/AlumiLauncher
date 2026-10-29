//! フォルダ・ファイルの操作(登録・移動・見張り・起動回数)のテスト。

use crate::config::model::MAX_USAGE;
use crate::files::operations::add_paths_into;
use crate::files::operations::move_file;
use crate::files::roots::is_allowed_folder;
use crate::files::roots::norm_path;
use crate::files::text_files::text_file_name;
use crate::files::usage::bump_usage;
use crate::files::usage::top_usage;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::time::Duration;

#[test]
fn usage_is_counted_capped_and_ranked() {
    let mut u = HashMap::new();
    let exe = std::env::current_exe()
        .unwrap()
        .to_string_lossy()
        .into_owned(); // 存在するパス
    bump_usage(&mut u, &exe, 10);
    bump_usage(&mut u, &exe, 20);
    bump_usage(&mut u, "C:\\no\\such\\file.lnk", 30);
    let top = top_usage(&u, true, 5);
    assert_eq!(top.len(), 1, "存在しないファイルは出さない");
    assert_eq!(u[&exe].count, 2);
    for i in 0..(MAX_USAGE as u64 + 20) {
        bump_usage(&mut u, &format!("p{i}"), 100 + i);
    }
    assert_eq!(u.len(), MAX_USAGE);
    assert!(!u.contains_key("p0"), "古いものから捨てる");
}

#[test]
fn text_file_names_are_safe() {
    assert_eq!(text_file_name("メモ", "x"), "メモ.txt");
    assert_eq!(text_file_name("a.txt", "x"), "a.txt");
    assert_eq!(text_file_name("README.MD", "x"), "README.MD");
    assert_eq!(text_file_name("a/b:c*?.txt", "x"), "abc.txt");
    assert_eq!(text_file_name("  ", "新しいテキスト"), "新しいテキスト.txt");
    assert_eq!(text_file_name("..\\..\\evil", "x"), "evil.txt");
    assert_eq!(text_file_name("con", "x"), "_con.txt");
    assert_eq!(text_file_name("LPT1.txt", "x"), "_LPT1.txt");
    assert!(text_file_name(&"あ".repeat(500), "x").chars().count() <= 84);
}

#[test]
fn folder_validation_rejects_roots_and_windows_dir() {
    assert!(!is_allowed_folder("C:\\"));
    assert!(!is_allowed_folder(
        &std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".into())
    ));
    assert!(!is_allowed_folder("C:\\this\\does\\not\\exist"));
    assert!(is_allowed_folder(&std::env::temp_dir().to_string_lossy()));
}

#[test]
fn dropped_files_are_moved_into_the_folder() {
    let base = std::env::temp_dir().join(format!("alumi-test-{}", std::process::id()));
    let dest = base.join("dest");
    fs::create_dir_all(&dest).unwrap();
    let src = base.join("tool.txt");
    fs::write(&src, "x").unwrap();
    let lnk_src = base.join("existing.lnk");
    fs::write(&lnk_src, "lnk").unwrap();

    let paths = |p: &Path| vec![p.to_string_lossy().into_owned()];
    assert_eq!(add_paths_into(&dest, paths(&src)).unwrap(), 1);
    assert!(
        dest.join("tool.txt").is_file() && !src.exists(),
        "ファイルは移動される"
    );
    fs::write(&src, "y").unwrap();
    assert_eq!(add_paths_into(&dest, paths(&src)).unwrap(), 1);
    assert!(dest.join("tool (2).txt").is_file(), "同名は連番になる");
    assert_eq!(add_paths_into(&dest, paths(&lnk_src)).unwrap(), 1);
    assert!(
        dest.join("existing.lnk").is_file() && !lnk_src.exists(),
        ".lnk も移動される"
    );
    assert!(add_paths_into(&base.join("missing"), paths(&src)).is_err());

    let _ = fs::remove_dir_all(&base);
}

#[test]
fn file_changes_in_a_watched_folder_are_reported() {
    use notify::{EventKind, RecursiveMode, Watcher};
    let base = std::env::temp_dir().join(format!("alumi-watch-{}", std::process::id()));
    fs::create_dir_all(base.join("sub")).unwrap();
    let (tx, rx) = std::sync::mpsc::channel();
    let mut w = notify::recommended_watcher(move |r: notify::Result<notify::Event>| {
        if let Ok(e) = r {
            let _ = tx.send(e);
        }
    })
    .unwrap();
    w.watch(&base, RecursiveMode::Recursive).unwrap();
    // 追加(サブフォルダの中も) → 削除 の両方が届く
    fs::write(base.join("sub").join("a.lnk"), "x").unwrap();
    let wait = |want_remove: bool| {
        let end = std::time::Instant::now() + Duration::from_secs(3);
        while std::time::Instant::now() < end {
            if let Ok(e) = rx.recv_timeout(Duration::from_millis(200)) {
                let hit = e.paths.iter().any(|p| {
                    norm_path(&p.to_string_lossy()).starts_with(&norm_path(&base.to_string_lossy()))
                });
                if hit && (!want_remove || matches!(e.kind, EventKind::Remove(_))) {
                    return true;
                }
            }
        }
        false
    };
    assert!(wait(false), "追加が届く");
    fs::remove_file(base.join("sub").join("a.lnk")).unwrap();
    assert!(wait(true), "削除が届く");
    drop(w);
    let _ = fs::remove_dir_all(&base);
}

#[test]
fn move_file_renames_and_avoids_overwriting() {
    let base = std::env::temp_dir().join(format!("alumi-move-{}", std::process::id()));
    let (a, b) = (base.join("a"), base.join("b"));
    fs::create_dir_all(&a).unwrap();
    fs::create_dir_all(&b).unwrap();
    fs::write(a.join("x.lnk"), "1").unwrap();
    fs::write(b.join("x.lnk"), "existing").unwrap();

    let moved = move_file(&a.join("x.lnk"), &b).unwrap();
    assert!(!a.join("x.lnk").exists(), "元の場所からは無くなる");
    assert_eq!(
        fs::read_to_string(b.join("x.lnk")).unwrap(),
        "existing",
        "既存のファイルは上書きしない"
    );
    assert_eq!(moved, b.join("x (2).lnk"));
    assert_eq!(fs::read_to_string(&moved).unwrap(), "1");

    let _ = fs::remove_dir_all(&base);
}
