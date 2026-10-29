//! 同梱のミニアプリ・ウィジェットの書き出し・検査のテスト。

use crate::extensions::bundled::bundled_miniapps;
use crate::extensions::bundled::generated::BUNDLED_WIDGETS;
use crate::extensions::bundled::read_seeded;
use crate::extensions::bundled::should_write_bundled;
use crate::extensions::bundled::write_seeded;
use crate::extensions::bundled::BUNDLED_MARK;
use crate::extensions::widgets;
use std::collections::HashSet;
use std::fs;

#[test]
fn deleted_bundled_apps_are_not_recreated_but_updates_are_applied() {
    let root = std::env::temp_dir().join(format!("alumi-seeded-{}", std::process::id()));
    let _ = fs::remove_dir_all(&root);
    fs::create_dir_all(&root).unwrap();
    let (dir, mut seeded) = (root.join("memo"), HashSet::new());
    assert!(
        should_write_bundled(&dir, "memo", &seeded, "2"),
        "初めては、書き出す"
    );
    fs::create_dir_all(&dir).unwrap();
    fs::write(dir.join(BUNDLED_MARK), "1").unwrap();
    seeded.insert("memo".to_string());
    assert!(
        should_write_bundled(&dir, "memo", &seeded, "2"),
        "版が違えば、更新する"
    );
    fs::write(dir.join(BUNDLED_MARK), "2").unwrap();
    assert!(
        !should_write_bundled(&dir, "memo", &seeded, "2"),
        "同じ版なら、触らない"
    );
    fs::remove_dir_all(&dir).unwrap();
    assert!(
        !should_write_bundled(&dir, "memo", &seeded, "3"),
        "利用者が削除したものは、版が変わっても作り直さない"
    );
    write_seeded(&root, &seeded);
    assert_eq!(read_seeded(&root), seeded, "記録は、保存して、読み戻せる");
    let _ = fs::remove_dir_all(&root);
}

#[test]
fn bundled_miniapps_are_valid() {
    let root = std::env::temp_dir().join(format!("alumi-bundled-m-{}", std::process::id()));
    let _ = fs::remove_dir_all(&root);
    for &(id, files) in bundled_miniapps() {
        for (name, body) in files {
            let path = root.join(id).join(name);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, body).unwrap();
        }
    }
    let apps = widgets::scan_miniapps(&root);
    assert_eq!(apps.len(), bundled_miniapps().len(), "全部、読める");
    for a in &apps {
        assert!(!a.icon.is_empty(), "{} のアイコン", a.id);
        assert!(
            a.permissions.is_empty() == !a.url.is_empty(),
            "{} の権限(知らない権限は捨てられる。URL を開くものは、権限なし)",
            a.id
        );
    }
    let _ = fs::remove_dir_all(&root);
}

#[test]
fn bundled_widget_definitions_are_valid() {
    let root = std::env::temp_dir().join(format!("alumi-bundled-w-{}", std::process::id()));
    let _ = fs::remove_dir_all(&root);
    for &(id, files) in BUNDLED_WIDGETS {
        for (name, body) in files {
            let path = root.join(id).join(name);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, body).unwrap();
        }
    }
    // データを預けるミニアプリ(ToDo の planner)がある場合は、全部読める。無い場合は、そのウィジェットだけ、一覧に出ない
    let minis = root.join("minis");
    let without = widgets::scan(&root, &minis);
    assert!(
        without.iter().all(|w| w.id != "todo") && without.len() == BUNDLED_WIDGETS.len() - 1,
        "データ元が無い ToDo は出ない"
    );
    fs::create_dir_all(minis.join("planner")).unwrap();
    let list = widgets::scan(&root, &minis);
    assert_eq!(list.len(), BUNDLED_WIDGETS.len(), "全部、読める");
    for w in &list {
        assert_eq!(w.builtin, w.id, "フォルダ名と種類が同じ");
        assert!(
            w.cells[0] >= 1 && w.cells[0] <= w.cells[2] && w.cells[2] <= w.cells[1],
            "{} の幅の範囲",
            w.id
        );
        assert!(
            crate::extensions::bundled::generated::BUNDLED_WIDGET_KINDS.contains(&w.id.as_str())
        );
    }
    let _ = fs::remove_dir_all(&root);
}

/// ランチャーの外のフォルダ(環境変数 `ALUMI_EXTERNAL_MINIAPPS`。`miniapp.json` を持つフォルダが並ぶ場所)のミニアプリを、
/// ドロップで取り込むときと同じ処理(`install_dir`)で取り込み、一覧に出て、画面のファイルが全部配信できるかを確かめる。
/// 手動で実行する: `$env:ALUMI_EXTERNAL_MINIAPPS = "<フォルダ>"; cargo test import_external_miniapps -- --ignored --nocapture`
#[test]
#[ignore]
fn import_external_miniapps() {
    let src_root = std::path::PathBuf::from(
        std::env::var("ALUMI_EXTERNAL_MINIAPPS")
            .expect("ALUMI_EXTERNAL_MINIAPPS を設定してください"),
    );
    let tmp = std::env::temp_dir().join(format!("alumi-import-{}", std::process::id()));
    let _ = fs::remove_dir_all(&tmp);
    let (w, m) = (tmp.join("widgets"), tmp.join("miniapps"));

    // 1. 取り込む(ドロップと同じ処理)
    let mut installed = Vec::new();
    for e in fs::read_dir(&src_root).unwrap().flatten() {
        let dir = e.path();
        if !dir.join("miniapp.json").is_file() {
            continue;
        }
        let r = widgets::install_dir(&dir, &w, &m)
            .unwrap_or_else(|err| panic!("{} の取り込みに失敗: {err}", dir.display()))
            .unwrap_or_else(|| panic!("{} は、ミニアプリとして取り込めない", dir.display()));
        assert_eq!(r.kind, "miniapp");
        assert_eq!(
            r.id,
            e.file_name().to_string_lossy(),
            "フォルダ名が ID になる"
        );
        println!("取り込み: {} ({})", r.id, r.name);
        installed.push(r.id);
    }
    assert!(!installed.is_empty(), "取り込めるミニアプリが 1 つもない");

    // 2. 一覧に出る
    let apps = widgets::scan_miniapps(&m);
    for id in &installed {
        let a = apps
            .iter()
            .find(|a| &a.id == id)
            .unwrap_or_else(|| panic!("{id} が一覧に出ない"));
        println!(
            "一覧: {} name={:?} entry={:?} icon={:?} permissions={:?} url={:?} network={}",
            a.id, a.name, a.entry, a.icon, a.permissions, a.url, a.network
        );
        assert!(!a.name.is_empty());
        assert!(!a.icon.is_empty(), "{id} のアイコンが読めない");
        // 3. 画面のファイル(入口と、そこから読み込む CSS・JS・画像)が、全部配信できる(Web ミニアプリは画面を持たない)
        if !a.url.is_empty() {
            assert!(
                a.network && a.permissions.is_empty(),
                "Web ミニアプリは、通信するもの・権限なし"
            );
            continue;
        }
        let html = fs::read_to_string(m.join(id).join(&a.entry)).unwrap();
        let base = std::path::Path::new(&a.entry)
            .parent()
            .unwrap()
            .to_string_lossy()
            .replace('\\', "/");
        let mut files = vec![a.entry.clone(), a.icon.clone()];
        for attr in ["src=\"", "href=\""] {
            for part in html.split(attr).skip(1) {
                let rel = part.split('"').next().unwrap();
                if rel.starts_with("http") || rel.starts_with('#') {
                    continue;
                }
                // 入口のフォルダからの相対(`../controller/main.js` など)を、ミニアプリのフォルダからの相対にする
                let mut parts: Vec<&str> = base.split('/').filter(|p| !p.is_empty()).collect();
                for seg in rel.split('/') {
                    match seg {
                        ".." => {
                            parts.pop();
                        }
                        "." | "" => {}
                        s => parts.push(s),
                    }
                }
                files.push(parts.join("/"));
            }
        }
        for f in files {
            let r = widgets::respond(&m, "miniapp.localhost", &format!("/{id}/{f}"), &[]);
            println!("配信: /{id}/{f} -> {}", r.status());
            assert_eq!(r.status(), 200, "{id}/{f} が配信できない");
            let csp = r
                .headers()
                .get("Content-Security-Policy")
                .unwrap()
                .to_str()
                .unwrap()
                .to_string();
            assert!(
                csp.contains("connect-src 'none'"),
                "通信しないミニアプリは、通信できない"
            );
        }
    }
    let _ = fs::remove_dir_all(&tmp);
}
