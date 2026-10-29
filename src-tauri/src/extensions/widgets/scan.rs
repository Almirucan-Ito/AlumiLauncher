//! ウィジェット・ミニアプリのマニフェストを読み、一覧を作る。

use super::*;

/// フォルダの中のマニフェストを読む(UTF-8。先頭の BOM は無視する)。
///
/// # 引数
/// * `dir` - ウィジェット/ミニアプリのフォルダ
/// * `file` - マニフェストのファイル名(`widget.json` または `miniapp.json`)
///
/// # 戻り値
/// 読めて、JSON として正しければ `Some`。そうでなければ `None`
pub(crate) fn read_manifest(dir: &Path, file: &str) -> Option<Manifest> {
    let text = fs::read_to_string(dir.join(file)).ok()?;
    serde_json::from_str::<Manifest>(text.trim_start_matches('\u{feff}')).ok()
}

/// 入口のファイル(`index.html` など)が、フォルダの中に実在するかを調べる。
///
/// # 引数
/// * `dir` - フォルダ
/// * `entry` - 入口のファイルの相対パス
///
/// # 戻り値
/// 実在する(フォルダの外を指していない)ファイルなら `true`
pub(crate) fn entry_ok(dir: &Path, entry: &str) -> bool {
    safe_join(dir, entry).map(|p| p.is_file()).unwrap_or(false)
}

/// アイコンのパスが、フォルダの中の実在する画像(png / svg / jpg / webp / gif)を指しているときだけ、そのパスを返す。
///
/// # 引数
/// * `dir` - フォルダ
/// * `icon` - マニフェストに書かれたアイコンの相対パス
///
/// # 戻り値
/// 使えるなら `icon` のまま。そうでなければ空文字
pub(crate) fn clean_icon(dir: &Path, icon: &str) -> String {
    let ext = Path::new(icon)
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    let image = matches!(
        ext.as_str(),
        "png" | "svg" | "jpg" | "jpeg" | "webp" | "gif"
    );
    if image && safe_join(dir, icon).map(|p| p.is_file()).unwrap_or(false) {
        icon.to_string()
    } else {
        String::new()
    }
}

/// フォルダの中のウィジェット(`<id>\widget.json`)を探して、`out` に足す。上限は `MAX_WIDGETS` 個。
/// 組み込み(`builtin`)は、ランチャーが実装を持つ種類だけ採用する。それ以外は、入口のファイルが実在するものだけ。
///
/// # 引数
/// * `root` - ウィジェットのフォルダが並ぶ場所
/// * `kind` - `"mod"`(widgets フォルダ)または `"mini"`(ミニアプリの中)
/// * `app`, `app_name`, `app_name_en` - `kind` が `"mini"` のとき、持ち主のミニアプリのフォルダ名と名前(日本語・英語。`"mod"` では空)
/// * `out` - 見つかったものを足す先
pub(crate) fn scan_widgets_in(
    root: &Path,
    kind: &str,
    app: &str,
    app_name: &str,
    app_name_en: &str,
    out: &mut Vec<WidgetInfo>,
) {
    let Ok(rd) = fs::read_dir(root) else { return };
    for e in rd.flatten() {
        if out.len() >= MAX_WIDGETS {
            return;
        }
        let Ok(ft) = e.file_type() else { continue };
        if !ft.is_dir() {
            continue;
        }
        let id = e.file_name().to_string_lossy().into_owned();
        if !valid_id(&id) {
            continue;
        }
        let dir = e.path();
        let Some(m) = read_manifest(&dir, "widget.json") else {
            continue;
        };
        // 組み込み(builtin)は、ランチャーが実装を持っているものだけ。それ以外は、入口のファイルが実在するものだけ一覧に出す
        let builtin = if crate::extensions::bundled::generated::BUNDLED_WIDGET_KINDS
            .contains(&m.builtin.as_str())
        {
            m.builtin.clone()
        } else {
            String::new()
        };
        if !m.builtin.is_empty() && builtin.is_empty() {
            continue;
        }
        let is_builtin = !builtin.is_empty();
        let entry = if m.entry.is_empty() {
            "index.html".to_string()
        } else {
            m.entry
        };
        if builtin.is_empty() && !entry_ok(&dir, &entry) {
            continue;
        }
        out.push(WidgetInfo {
            name: if m.name.trim().is_empty() {
                id.clone()
            } else {
                m.name.chars().take(40).collect()
            },
            description: m.description.chars().take(200).collect(),
            icon: clean_icon(&dir, &m.icon),
            entry,
            width: if m.width == 0 {
                160
            } else {
                m.width.clamp(60, 600)
            },
            height: if m.height == 0 {
                60
            } else {
                m.height.clamp(24, 200)
            },
            builtin,
            data_app: if valid_id(&m.data_app) {
                m.data_app.clone()
            } else {
                String::new()
            },
            name_en: m.name_en.chars().take(40).collect(),
            description_en: m.description_en.chars().take(200).collect(),
            cells: m
                .cells
                .filter(|c| c[0] >= 1 && c[0] <= c[2] && c[2] <= c[1] && c[1] <= 7)
                .unwrap_or([0, 0, 0]),
            network: m.network && !is_builtin,
            kind: kind.into(),
            app: app.into(),
            app_name: app_name.into(),
            app_name_en: app_name_en.into(),
            id,
        });
    }
}

/// ウィジェットの一覧を作る(widgets フォルダのもの → ミニアプリの中のもの、の順)。
///
/// # 引数
/// * `widgets_root` - `%AppData%\AlumiLauncher\widgets`
/// * `miniapps_root` - `%AppData%\AlumiLauncher\miniapps`
///
/// # 戻り値
/// ウィジェットの情報の一覧(widgets フォルダのものは ID の昇順)
pub fn scan(widgets_root: &Path, miniapps_root: &Path) -> Vec<WidgetInfo> {
    let mut out = Vec::new();
    scan_widgets_in(widgets_root, "mod", "", "", "", &mut out);
    // データを預けるミニアプリ(`data_app`。ToDo の「予定とToDo」など)が、削除されて無いウィジェットは、一覧に出さない
    // (出すと、見た目は動いているのに、入力したものが保存されない)
    out.retain(|w| w.data_app.is_empty() || miniapps_root.join(&w.data_app).is_dir());
    out.sort_by_key(|a| a.id.to_lowercase());
    for app in scan_miniapps(miniapps_root) {
        scan_widgets_in(
            &miniapps_root.join(&app.id).join("widgets"),
            "mini",
            &app.id,
            &app.name,
            &app.name_en,
            &mut out,
        );
    }
    out
}

/// ミニアプリの一覧を作る。`url` を持つもの(Web ミニアプリ)は入口のファイルが不要で、通信するもの(`network`)として扱う。
/// 知らない権限は捨てる。上限は `MAX_MINIAPPS` 個。
///
/// # 引数
/// * `root` - `%AppData%\AlumiLauncher\miniapps`
///
/// # 戻り値
/// ミニアプリの情報の一覧(名前の昇順)
pub fn scan_miniapps(root: &Path) -> Vec<MiniAppInfo> {
    let Ok(rd) = fs::read_dir(root) else {
        return Vec::new();
    };
    let mut out = Vec::new();
    for e in rd.flatten() {
        if out.len() >= MAX_MINIAPPS {
            break;
        }
        let Ok(ft) = e.file_type() else { continue };
        if !ft.is_dir() {
            continue;
        }
        let id = e.file_name().to_string_lossy().into_owned();
        if !valid_id(&id) {
            continue;
        }
        let dir = e.path();
        let Some(m) = read_manifest(&dir, "miniapp.json") else {
            continue;
        };
        let entry = if m.entry.is_empty() {
            "index.html".to_string()
        } else {
            m.entry
        };
        let url = clean_url(&m.url);
        let url_for_net = url.clone();
        if url.is_empty() && !entry_ok(&dir, &entry) {
            continue;
        }
        out.push(MiniAppInfo {
            url,
            mobile: m.mobile,
            network: m.network || !url_for_net.is_empty(),
            name: if m.name.trim().is_empty() {
                id.clone()
            } else {
                m.name.chars().take(40).collect()
            },
            description: m.description.chars().take(200).collect(),
            name_en: m.name_en.chars().take(40).collect(),
            description_en: m.description_en.chars().take(200).collect(),
            icon: clean_icon(&dir, &m.icon),
            permissions: m
                .permissions
                .into_iter()
                .filter(|p| {
                    crate::extensions::bundled::generated::KNOWN_PERMISSIONS.contains(&p.as_str())
                })
                .collect(),
            entry,
            id,
        });
    }
    out.sort_by_key(|a| a.name.to_lowercase());
    out
}
