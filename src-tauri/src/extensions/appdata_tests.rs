//! データ・キャッシュの保存と消去のテスト。

use super::*;

fn tmp(name: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!("alumi-appdata-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&d);
    fs::create_dir_all(&d).unwrap();
    d
}

#[test]
fn data_is_stored_in_the_data_folder_and_can_be_cleared() {
    let app = tmp("data");
    set(&app, "tasks", "[1,2]").unwrap();
    set(&app, "_alarms", "x").unwrap();
    assert!(app.join("data").join("tasks.txt").is_file());
    let all = load(&app);
    assert_eq!((all.len(), all["tasks"].as_str()), (2, "[1,2]"));
    assert!(set(&app, "../evil", "x").is_err());
    assert!(set(&app, ".hidden", "x").is_err());
    assert!(set(&app, "big", &"a".repeat(MAX_VALUE + 1)).is_err());
    set(&app, "tasks", "[3]").unwrap(); // 上書き
    assert_eq!(load(&app)["tasks"], "[3]");
    assert!(usage(&app).data > 0);
    clear_data(&app).unwrap();
    assert!(load(&app).is_empty() && !app.join("data").exists());
    let _ = fs::remove_dir_all(&app);
}

#[test]
fn cache_is_separate_and_webview_cache_is_counted_as_cache() {
    let app = tmp("cache");
    cache_set(&app, "k", "v").unwrap();
    assert_eq!(cache_get(&app, "k").as_deref(), Some("v"));
    set(&app, "keep", "me").unwrap();
    // Web ミニアプリのプロファイル(Cookies = データ / Cache = キャッシュ)
    let wv = app
        .join("data")
        .join("webview")
        .join("EBWebView")
        .join("Default");
    fs::create_dir_all(wv.join("Cache")).unwrap();
    fs::write(wv.join("Cache").join("c1"), vec![0u8; 1000]).unwrap();
    fs::write(wv.join("Cookies"), vec![0u8; 500]).unwrap();
    let u = usage(&app);
    assert!(u.cache >= 1000 && u.data >= 500, "{u:?}");
    clear_cache(&app).unwrap();
    assert!(cache_get(&app, "k").is_none() && !wv.join("Cache").exists());
    assert!(wv.join("Cookies").is_file(), "Cookies(データ)は残る");
    assert_eq!(load(&app)["keep"], "me");
    let _ = fs::remove_dir_all(&app);
}

#[test]
fn thumb_cache_names_follow_the_file_and_pruning_keeps_the_limit() {
    let d = tmp("thumb");
    let f = d.join("a.png");
    fs::write(&f, [1u8; 10]).unwrap();
    let k1 = thumb_key(&f).unwrap();
    assert_eq!(k1, thumb_key(&f).unwrap());
    fs::write(&f, [1u8; 20]).unwrap();
    assert_ne!(k1, thumb_key(&f).unwrap(), "中身が変わったら、別の名前");
    let c = d.join("c");
    fs::create_dir_all(&c).unwrap();
    for i in 0..5 {
        fs::write(c.join(format!("{i}.png")), vec![0u8; 100]).unwrap();
    }
    prune(&c, 250);
    assert!(dir_size(&c) <= 250);
    let _ = fs::remove_dir_all(&d);
}
