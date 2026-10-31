//! マニフェスト・一覧・取り込み・配信のテスト。

use super::*;

fn tmp(name: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!("alumi-widgets-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&d);
    fs::create_dir_all(&d).unwrap();
    d
}

#[test]
fn scan_lists_valid_widgets_only() {
    let root = tmp("scan");
    let w = root.join("hello");
    fs::create_dir_all(&w).unwrap();
    fs::write(
        w.join("widget.json"),
        r#"{"name":"Hello","height":80,"icon":"icon.svg"}"#,
    )
    .unwrap();
    fs::write(w.join("index.html"), "<p>hi</p>").unwrap();
    fs::write(w.join("icon.svg"), "<svg/>").unwrap();
    // 入口が無い
    fs::create_dir_all(root.join("broken")).unwrap();
    fs::write(root.join("broken").join("widget.json"), "{}").unwrap();
    // 入口が外を指す
    fs::create_dir_all(root.join("evil")).unwrap();
    fs::write(
        root.join("evil").join("widget.json"),
        r#"{"entry":"../hello/index.html"}"#,
    )
    .unwrap();
    let list = scan(&root, &root.join("none"));
    assert_eq!(list.len(), 1);
    assert_eq!(
        (
            list[0].id.as_str(),
            list[0].name.as_str(),
            list[0].height,
            list[0].width
        ),
        ("hello", "Hello", 80, 160)
    );
    assert_eq!(
        (list[0].icon.as_str(), list[0].kind.as_str()),
        ("icon.svg", "mod")
    );
    let _ = fs::remove_dir_all(&root);
}

#[test]
fn english_names_of_a_miniapp_reach_its_widgets_and_are_trimmed() {
    let root = tmp("en");
    let a = root.join("notes");
    fs::create_dir_all(a.join("widgets").join("w1")).unwrap();
    let long = "x".repeat(300);
    fs::write(
        a.join("miniapp.json"),
        format!(r#"{{"name":"メモ","name_en":"Notes","description_en":"{long}"}}"#),
    )
    .unwrap();
    fs::write(a.join("index.html"), "x").unwrap();
    fs::write(
        a.join("widgets").join("w1").join("widget.json"),
        r#"{"name":"W1"}"#,
    )
    .unwrap();
    fs::write(a.join("widgets").join("w1").join("index.html"), "x").unwrap();
    let apps = scan_miniapps(&root);
    assert_eq!(apps[0].name_en, "Notes");
    assert_eq!(
        apps[0].description_en.chars().count(),
        200,
        "説明は 200 字まで"
    );
    // ミニアプリの中のウィジェットは、持ち主の名前(日本語・英語)を持つ
    let widgets = scan(&root.join("none"), &root);
    assert_eq!(
        (
            widgets[0].app_name.as_str(),
            widgets[0].app_name_en.as_str()
        ),
        ("メモ", "Notes")
    );
    let _ = fs::remove_dir_all(&root);
}

#[test]
fn miniapps_and_their_widgets_are_listed() {
    let root = tmp("mini");
    let a = root.join("notes");
    fs::create_dir_all(a.join("widgets").join("w1")).unwrap();
    fs::write(
        a.join("miniapp.json"),
        r#"{"name":"Notes","permissions":["saveText","hack"],"icon":"../x.png"}"#,
    )
    .unwrap();
    fs::write(a.join("index.html"), "x").unwrap();
    fs::write(
        a.join("widgets").join("w1").join("widget.json"),
        r#"{"name":"W1"}"#,
    )
    .unwrap();
    fs::write(a.join("widgets").join("w1").join("index.html"), "x").unwrap();
    // マニフェストの無いフォルダは出さない
    fs::create_dir_all(root.join("empty")).unwrap();
    let apps = scan_miniapps(&root);
    assert_eq!(apps.len(), 1);
    assert_eq!(
        apps[0].permissions,
        vec!["saveText".to_string()],
        "知らない権限は捨てる"
    );
    assert_eq!(apps[0].icon, "", "フォルダの外を指すアイコンは使わない");
    let widgets = scan(&root.join("none"), &root);
    assert_eq!(widgets.len(), 1);
    assert_eq!(
        (
            widgets[0].kind.as_str(),
            widgets[0].app.as_str(),
            widgets[0].app_name.as_str()
        ),
        ("mini", "notes", "Notes")
    );
    let _ = fs::remove_dir_all(&root);
}

#[test]
fn a_miniapp_can_hold_a_builtin_widget_definition() {
    let root = tmp("minibuiltin");
    let w = root.join("music").join("widgets").join("music");
    fs::create_dir_all(&w).unwrap();
    fs::write(
        root.join("music").join("miniapp.json"),
        r#"{"name":"M","url":"https://example.com/"}"#,
    )
    .unwrap();
    fs::write(
        w.join("widget.json"),
        r#"{"builtin":"music","name":"Music","cells":[3,7,5]}"#,
    )
    .unwrap();
    let list = scan(&root.join("none"), &root);
    assert_eq!(list.len(), 1);
    assert_eq!(
        (
            list[0].builtin.as_str(),
            list[0].kind.as_str(),
            list[0].app.as_str()
        ),
        ("music", "mini", "music")
    );
    let _ = fs::remove_dir_all(&root);
}

#[test]
fn respond_serves_inside_and_blocks_outside() {
    let root = tmp("respond");
    let w = root.join("hello");
    fs::create_dir_all(&w).unwrap();
    fs::write(w.join("index.html"), "ok").unwrap();
    fs::write(root.join("secret.txt"), "no").unwrap();
    assert_eq!(
        respond(&root, "widget.localhost", "/hello/index.html", &[]).status(),
        200
    );
    assert_eq!(
        respond(&root, "widget.localhost", "/hello/missing.html", &[]).status(),
        404
    );
    assert_eq!(
        respond(&root, "widget.localhost", "/hello/../secret.txt", &[]).status(),
        404
    );
    assert_eq!(
        respond(&root, "widget.localhost", "/../secret.txt", &[]).status(),
        404
    );
    assert_eq!(
        respond(&root, "widget.localhost", "/hello/C:/Windows/win.ini", &[]).status(),
        404
    );
    assert_eq!(
        respond(&root, "widget.localhost", "/hello", &[]).status(),
        404
    );
    let _ = fs::remove_dir_all(&root);
}

#[test]
fn respond_range_returns_a_part_with_206() {
    let root = tmp("range");
    let w = root.join("v");
    fs::create_dir_all(&w).unwrap();
    let data: Vec<u8> = (0..=255u8).collect();
    fs::write(w.join("a.bin"), &data).unwrap();
    let get =
        |range: Option<&str>| respond_range(&root, "miniapp.localhost", "/v/a.bin", &[], range);
    let r = get(Some("bytes=10-19"));
    assert_eq!(r.status(), 206);
    assert_eq!(r.headers().get("Content-Range").unwrap(), "bytes 10-19/256");
    assert_eq!(r.body().as_slice(), &data[10..20]);
    let r = get(Some("bytes=250-"));
    assert_eq!(r.status(), 206);
    assert_eq!(r.body().as_slice(), &data[250..]);
    assert_eq!(get(Some("bytes=999-")).status(), 416);
    let r = get(None);
    assert_eq!(r.status(), 200);
    assert_eq!(r.body().len(), 256);
    assert_eq!(r.headers().get("Accept-Ranges").unwrap(), "bytes");
    let _ = fs::remove_dir_all(&root);
}

#[test]
fn network_needs_both_a_declaration_and_consent() {
    let root = tmp("network");
    let w = root.join("net");
    fs::create_dir_all(&w).unwrap();
    fs::write(w.join("widget.json"), r#"{"name":"N","network":true}"#).unwrap();
    fs::write(w.join("index.html"), "x").unwrap();
    let quiet = root.join("quiet");
    fs::create_dir_all(&quiet).unwrap();
    fs::write(quiet.join("widget.json"), r#"{"name":"Q"}"#).unwrap();
    fs::write(quiet.join("index.html"), "x").unwrap();
    let csp_of = |id: &str, allowed: &[String]| {
        let r = respond(
            &root,
            "widget.localhost",
            &format!("/{id}/index.html"),
            allowed,
        );
        r.headers()
            .get("Content-Security-Policy")
            .unwrap()
            .to_str()
            .unwrap()
            .to_string()
    };
    let yes = vec!["widget:net".to_string(), "widget:quiet".to_string()];
    assert!(
        csp_of("net", &[]).contains("connect-src 'none'"),
        "同意がないと、通信できない"
    );
    assert!(
        csp_of("net", &yes).contains("connect-src https:"),
        "宣言して、同意があれば、通信できる"
    );
    assert!(
        csp_of("quiet", &yes).contains("connect-src 'none'"),
        "宣言していなければ、同意があっても、通信できない"
    );
    assert_eq!(
        consent_key("miniapp.localhost", &root, "app", "widgets/w1/index.html").0,
        "widget:app/w1"
    );
    assert_eq!(
        consent_key("miniapp.localhost", &root, "app", "index.html").0,
        "miniapp:app"
    );
    let _ = fs::remove_dir_all(&root);
}

#[test]
fn icon_is_inlined_only_from_inside_the_folder() {
    let root = tmp("icon");
    let a = root.join("app");
    fs::create_dir_all(&a).unwrap();
    fs::write(a.join("miniapp.json"), r#"{"icon":"i.png"}"#).unwrap();
    fs::write(a.join("i.png"), [1u8, 2, 3]).unwrap();
    assert!(icon_data_uri(&root, "app")
        .unwrap()
        .starts_with("data:image/png;base64,"));
    assert!(icon_data_uri(&root, "../app").is_none());
    let _ = fs::remove_dir_all(&root);
}

#[test]
fn dropped_folders_are_installed_by_manifest() {
    let base = tmp("install");
    let (w, m) = (base.join("w"), base.join("m"));
    let src = base.join("src");
    let wsrc = src.join("my widget");
    fs::create_dir_all(wsrc.join("sub")).unwrap();
    fs::write(wsrc.join("widget.json"), r#"{"name":"W"}"#).unwrap();
    fs::write(wsrc.join("index.html"), "x").unwrap();
    fs::write(wsrc.join("sub").join("a.js"), "x").unwrap();
    let r = install_dir(&wsrc, &w, &m).unwrap().unwrap();
    assert_eq!(
        (r.kind.as_str(), r.id.as_str(), r.name.as_str()),
        ("widget", "my-widget", "W")
    );
    assert!(w.join("my-widget").join("sub").join("a.js").is_file());
    // 同じものをもう一度: 置き換え
    assert!(install_dir(&wsrc, &w, &m).unwrap().is_some());
    // Web ミニアプリ(URL だけ)
    let k = src.join("webapp");
    fs::create_dir_all(&k).unwrap();
    fs::write(
        k.join("miniapp.json"),
        r#"{"name":"Web","url":"https://example.com/"}"#,
    )
    .unwrap();
    assert_eq!(install_dir(&k, &w, &m).unwrap().unwrap().kind, "miniapp");
    assert_eq!(scan_miniapps(&m)[0].url, "https://example.com/");
    // http や、マニフェストの無いフォルダは取り込まない
    let bad = src.join("bad");
    fs::create_dir_all(&bad).unwrap();
    fs::write(bad.join("miniapp.json"), r#"{"url":"http://example.com/"}"#).unwrap();
    assert!(install_dir(&bad, &w, &m).unwrap().is_none());
    assert!(install_dir(&src, &w, &m).unwrap().is_none());
    // 取り込み先の中のフォルダ自身は、もう一度コピーしない
    assert!(install_dir(&m.join("webapp"), &w, &m).unwrap().is_none());
    let _ = fs::remove_dir_all(&base);
}

#[test]
fn ids_are_restricted() {
    assert!(valid_id("my-widget_2"));
    assert!(!valid_id(".hidden"));
    assert!(!valid_id("a/b"));
    assert!(!valid_id(""));
}
