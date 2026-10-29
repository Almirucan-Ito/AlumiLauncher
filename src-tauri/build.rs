//! ビルド時に、同梱するミニアプリ・ウィジェットの一覧を作る(`$OUT_DIR/bundled.rs`)。
//!
//! - `src/miniapps/<id>/`(`miniapp.json` があるフォルダ)と `src/widgets/<id>/`(`widget.json` があるフォルダ)を、フォルダごと実行ファイルに埋め込む。
//!   フォルダを足すだけで同梱される(Rust のコードを書き換える必要はない)。
//! - フォルダ名が `_` で始まるもの(見本)と、`common` は対象外。TypeScript(`.ts` / `.tsx`)は、ランチャーの画面側で使うソースなので、埋め込まない。
//! - 同梱するものの内容から「版」(ハッシュ)を作る。内容が変わると版が変わり、次の起動で、書き出し直される(手で版を上げる必要はない)。
//! - `widget.json` の `builtin`(ランチャーが実装を持つウィジェットの種類)の一覧も作る(ウィジェットの一覧を検査するときの許可リスト)。
//! - ミニアプリが使える権限の一覧(`KNOWN_PERMISSIONS`)も作る。元は `schemas/miniapp.schema.json`(権限の名前は、ここ 1 か所で決める)。

use std::collections::BTreeSet;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

/// 埋め込まない拡張子(ランチャーの画面側のソース)。
const SKIP_EXT: [&str; 2] = ["ts", "tsx"];
/// 同梱の対象にしないフォルダ名(ウィジェット置き場の共通の部品など)。
const SKIP_DIRS: [&str; 2] = ["common", "node_modules"];

/// 同梱する 1 つのフォルダ(`id` と、その中のファイル)。
struct Bundle {
    id: String,
    /// `(フォルダ内の相対パス(`/` 区切り), 実際のパス)`
    files: Vec<(String, PathBuf)>,
}

/// フォルダの中のファイルを、再帰的に集める(並びは名前順)。
///
/// # 引数
/// * `base` - 相対パスの基準になるフォルダ
/// * `dir` - 集めるフォルダ
/// * `out` - 集めた結果の足し先
fn collect(base: &Path, dir: &Path, out: &mut Vec<(String, PathBuf)>) {
    let mut entries: Vec<_> = fs::read_dir(dir)
        .unwrap_or_else(|e| panic!("{} を読めません: {e}", dir.display()))
        .flatten()
        .collect();
    entries.sort_by_key(|e| e.file_name());
    for e in entries {
        let path = e.path();
        let name = e.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }
        if path.is_dir() {
            if !SKIP_DIRS.contains(&name.as_str()) {
                collect(base, &path, out);
            }
            continue;
        }
        let ext = path
            .extension()
            .map(|x| x.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        if SKIP_EXT.contains(&ext.as_str()) {
            continue;
        }
        let rel = path
            .strip_prefix(base)
            .unwrap()
            .components()
            .map(|c| c.as_os_str().to_string_lossy().into_owned())
            .collect::<Vec<_>>()
            .join("/");
        out.push((rel, path));
    }
}

/// `root` の直下で、`manifest` を持つフォルダを、同梱の対象として集める。
///
/// # 引数
/// * `root` - `src/miniapps` または `src/widgets`
/// * `manifest` - マニフェストのファイル名
///
/// # 戻り値
/// 同梱するフォルダの一覧(名前順)
fn bundles(root: &Path, manifest: &str) -> Vec<Bundle> {
    let mut out = Vec::new();
    let Ok(rd) = fs::read_dir(root) else {
        return out;
    };
    let mut dirs: Vec<_> = rd.flatten().filter(|e| e.path().is_dir()).collect();
    dirs.sort_by_key(|e| e.file_name());
    for e in dirs {
        let id = e.file_name().to_string_lossy().into_owned();
        if id.starts_with('_') || id.starts_with('.') || SKIP_DIRS.contains(&id.as_str()) {
            continue;
        }
        let Ok(text) = fs::read_to_string(e.path().join(manifest)) else {
            continue;
        };
        serde_json::from_str::<serde_json::Value>(text.trim_start_matches('\u{feff}'))
            .unwrap_or_else(|err| panic!("{id}/{manifest} が JSON として読めません: {err}"));
        let mut files = Vec::new();
        collect(&e.path(), &e.path(), &mut files);
        out.push(Bundle { id, files });
    }
    out
}

/// 同梱するものの内容から、版(ハッシュ。FNV-1a)を作る。
///
/// # 引数
/// * `bundles` - 同梱するもの
///
/// # 戻り値
/// 16 桁の 16 進数の文字列
fn version_of(bundles: &[Bundle]) -> String {
    let mut h: u64 = 0xcbf29ce484222325;
    let mut feed = |bytes: &[u8]| {
        for b in bytes {
            h ^= *b as u64;
            h = h.wrapping_mul(0x100000001b3);
        }
        h ^= 0xff;
        h = h.wrapping_mul(0x100000001b3);
    };
    for b in bundles {
        feed(b.id.as_bytes());
        for (rel, path) in &b.files {
            feed(rel.as_bytes());
            feed(&fs::read(path).unwrap_or_default());
        }
    }
    format!("{h:016x}")
}

/// 同梱するものを、Rust のコード(`include_str!` の並び)にする。
///
/// # 引数
/// * `name` - 作る定数の名前
/// * `bundles` - 同梱するもの
///
/// # 戻り値
/// Rust のコードの文字列
fn emit(name: &str, bundles: &[Bundle]) -> String {
    let mut s = format!("pub const {name}: &[(&str, &[(&str, &str)])] = &[\n");
    for b in bundles {
        s += &format!("    ({:?}, &[\n", b.id);
        for (rel, path) in &b.files {
            s += &format!(
                "        ({rel:?}, include_str!({:?})),\n",
                path.to_string_lossy()
            );
        }
        s += "    ]),\n";
    }
    s + "];\n"
}

fn main() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let src = manifest_dir.join("..").join("src");
    let (miniapps_dir, widgets_dir) = (src.join("miniapps"), src.join("widgets"));
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed={}", miniapps_dir.display());
    println!("cargo:rerun-if-changed={}", widgets_dir.display());
    let schema_path = manifest_dir
        .join("..")
        .join("schemas")
        .join("miniapp.schema.json");
    println!("cargo:rerun-if-changed={}", schema_path.display());

    let miniapps = bundles(&miniapps_dir, "miniapp.json");
    let widgets = bundles(&widgets_dir, "widget.json");

    // ランチャーが実装を持つウィジェットの種類(`widget.json` の builtin)。ミニアプリの中のウィジェットも含む
    let mut kinds = BTreeSet::new();
    let mut add_kinds = |dir: &Path| {
        if let Ok(text) = fs::read_to_string(dir.join("widget.json")) {
            if let Ok(j) =
                serde_json::from_str::<serde_json::Value>(text.trim_start_matches('\u{feff}'))
            {
                if let Some(k) = j.get("builtin").and_then(|k| k.as_str()) {
                    if !k.is_empty() {
                        kinds.insert(k.to_string());
                    }
                }
            }
        }
    };
    for w in &widgets {
        add_kinds(&widgets_dir.join(&w.id));
    }
    for m in &miniapps {
        if let Ok(rd) = fs::read_dir(miniapps_dir.join(&m.id).join("widgets")) {
            for e in rd.flatten() {
                add_kinds(&e.path());
            }
        }
    }

    // ミニアプリの権限の名前(スキーマの permissions の enum)
    let schema: serde_json::Value = serde_json::from_str(
        &fs::read_to_string(&schema_path)
            .unwrap_or_else(|e| panic!("{} を読めません: {e}", schema_path.display())),
    )
    .unwrap_or_else(|e| panic!("miniapp.schema.json が JSON として読めません: {e}"));
    let permissions: Vec<String> = schema["properties"]["permissions"]["items"]["enum"]
        .as_array()
        .unwrap_or_else(|| panic!("miniapp.schema.json に、permissions の enum がありません"))
        .iter()
        .filter_map(|v| v.as_str().map(str::to_string))
        .collect();

    let mut code = String::from("// build.rs が作った。手で書き換えない。\n");
    code += &emit("BUNDLED_MINIAPPS", &miniapps);
    code += &emit("BUNDLED_WIDGETS", &widgets);
    code += &format!(
        "pub const BUNDLED_VERSION: &str = {:?};\npub const BUNDLED_WIDGETS_VERSION: &str = {:?};\n",
        version_of(&miniapps),
        version_of(&widgets)
    );
    code += &format!(
        "pub const KNOWN_PERMISSIONS: &[&str] = &[{}];\n",
        permissions
            .iter()
            .map(|k| format!("{k:?}"))
            .collect::<Vec<_>>()
            .join(", ")
    );
    code += &format!(
        "pub const BUNDLED_WIDGET_KINDS: &[&str] = &[{}];\n",
        kinds
            .iter()
            .map(|k| format!("{k:?}"))
            .collect::<Vec<_>>()
            .join(", ")
    );
    fs::write(
        PathBuf::from(env::var("OUT_DIR").unwrap()).join("bundled.rs"),
        code,
    )
    .unwrap();

    tauri_build::build()
}
