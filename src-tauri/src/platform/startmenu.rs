//! スタートメニューのアプリ(「すべてのアプリ」に並ぶもの。通常のアプリも、ストアアプリも)の一覧と、ショートカットとしての複製。
//!
//! 一覧は、シェルの「アプリ」フォルダ(`shell:AppsFolder`)から読む。スタートメニューに出るものと同じ。
//! 複製は、そのアプリのシェル上の位置(ID リスト)を書いた `.lnk` を作る(エクスプローラーの「ショートカットの作成」と同じ作り)。元のアプリ・スタートメニューには、何もしない。

use std::path::{Path, PathBuf};

use serde::Serialize;

/// スタートメニューのアプリ 1 つ。`id` は、シェルでの名前(`shell:AppsFolder` の中の位置)で、複製するときに使う。
#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct StartApp {
    pub name: String,
    pub id: String,
}

/// ショートカットのファイル名に使えない文字を、空白にして整える。空になったら `"App"`。
///
/// # 引数
/// * `name` - アプリの表示名
///
/// # 戻り値
/// ファイル名(拡張子なし)
pub fn safe_file_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| {
            if c.is_control() || "<>:\"/\\|?*".contains(c) {
                ' '
            } else {
                c
            }
        })
        .collect();
    let trimmed = cleaned.trim().trim_end_matches('.').trim();
    if trimmed.is_empty() {
        "App".to_string()
    } else {
        trimmed.chars().take(100).collect()
    }
}

/// 名前の順(大文字小文字を区別しない)に並べ、同じ名前と ID の重複をなくす。
///
/// # 引数
/// * `apps` - 並べ替える前の一覧
///
/// # 戻り値
/// 整えた一覧
pub fn tidy(mut apps: Vec<StartApp>) -> Vec<StartApp> {
    apps.retain(|a| !a.name.trim().is_empty() && !a.id.is_empty());
    apps.sort_by(|a, b| {
        a.name
            .to_lowercase()
            .cmp(&b.name.to_lowercase())
            .then_with(|| a.id.cmp(&b.id))
    });
    apps.dedup_by(|a, b| a.id == b.id);
    apps
}

/// スタートメニューのアプリの一覧を読む。
///
/// # 戻り値
/// 名前順の一覧。読めなければ理由
pub fn list() -> Result<Vec<StartApp>, String> {
    #[cfg(windows)]
    {
        imp::list()
    }
    #[cfg(not(windows))]
    {
        Err("unsupported".into())
    }
}

/// スタートメニューのアプリを、ショートカット(`.lnk`)として `dir` に複製する(同名があれば連番)。元のアプリには何もしない。
/// `id` は、`list` が返したものだけ使える(任意の場所を指すショートカットを作らせないため、一覧と照らし合わせる)。
///
/// # 引数
/// * `id` - `list` が返した ID
/// * `dir` - 作る先のフォルダ(実在すること)
///
/// # 戻り値
/// 作ったショートカットのパス。失敗したら理由
pub fn create_shortcut(id: &str, dir: &Path) -> Result<PathBuf, String> {
    #[cfg(windows)]
    {
        imp::create_shortcut(id, dir)
    }
    #[cfg(not(windows))]
    {
        let _ = (id, dir);
        Err("unsupported".into())
    }
}

#[cfg(windows)]
mod imp {
    use std::path::{Path, PathBuf};

    use windows::core::{Interface, PCWSTR};
    use windows::Win32::Foundation::HANDLE;
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize, IPersistFile,
        CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED,
    };
    use windows::Win32::UI::Shell::{
        BHID_EnumItems, FOLDERID_AppsFolder, IEnumShellItems, IShellItem, IShellLinkW,
        SHGetIDListFromObject, SHGetKnownFolderItem, ShellLink, KF_FLAG_DEFAULT, SIGDN,
        SIGDN_DESKTOPABSOLUTEPARSING, SIGDN_NORMALDISPLAY,
    };

    use super::{safe_file_name, tidy, StartApp};

    /// このスレッドで COM を使えるようにする(スレッドごとに必要。終わったら元に戻す)。
    struct Com(bool);

    impl Com {
        fn new() -> Self {
            // すでに別の方式で始まっているスレッド(RPC_E_CHANGED_MODE)では、そのまま使い、終わりの処理もしない
            // SAFETY: 引数なしの COM の初期化。失敗(別の方式で始まっている)のときは、終わりの処理を行わない(`Drop` で、成功したときだけ解除する)。
            Com(unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) }.is_ok())
        }
    }

    impl Drop for Com {
        fn drop(&mut self) {
            if self.0 {
                // SAFETY: `new` で初期化に成功したときだけ呼ぶ(初期化と、対になる)。
                unsafe { CoUninitialize() };
            }
        }
    }

    /// シェルの項目の表示名を、文字列で取り出す。
    ///
    /// # 引数
    /// * `item` - シェルの項目
    /// * `kind` - 取り出す名前の種類
    ///
    /// # Safety
    /// COM が、このスレッドで初期化されていて、`item` が有効であること。
    unsafe fn name_of(item: &IShellItem, kind: SIGDN) -> windows::core::Result<String> {
        let p = item.GetDisplayName(kind)?;
        let s = p.to_string().unwrap_or_default();
        CoTaskMemFree(Some(p.0 as _));
        Ok(s)
    }

    /// 「アプリ」フォルダの中の項目を、全部読む(`(名前, ID, 項目)`)。
    ///
    /// # Safety
    /// COM が、このスレッドで初期化されていること。
    unsafe fn items() -> windows::core::Result<Vec<(StartApp, IShellItem)>> {
        let folder: IShellItem =
            SHGetKnownFolderItem(&FOLDERID_AppsFolder, KF_FLAG_DEFAULT, HANDLE::default())?;
        let en: IEnumShellItems = folder.BindToHandler(None, &BHID_EnumItems)?;
        let mut out = Vec::new();
        loop {
            let mut one: [Option<IShellItem>; 1] = [None];
            let mut got = 0u32;
            en.Next(&mut one, Some(&mut got))?; // 最後まで読むと、got が 0 になる
            if got == 0 {
                break;
            }
            let Some(item) = one[0].take() else { break };
            let name = name_of(&item, SIGDN_NORMALDISPLAY).unwrap_or_default();
            let id = name_of(&item, SIGDN_DESKTOPABSOLUTEPARSING).unwrap_or_default();
            out.push((StartApp { name, id }, item));
        }
        Ok(out)
    }

    pub fn list() -> Result<Vec<StartApp>, String> {
        let _com = Com::new();
        // SAFETY: `_com` が、このスレッドの COM を初期化している。`items` の戻り値の COM のオブジェクトは、この関数の中だけで使う。
        let all = unsafe { items() }.map_err(|e| e.to_string())?;
        Ok(tidy(all.into_iter().map(|(a, _)| a).collect()))
    }

    pub fn create_shortcut(id: &str, dir: &Path) -> Result<PathBuf, String> {
        if !dir.is_dir() {
            return Err("not_found".into());
        }
        let _com = Com::new();
        // SAFETY: `_com` が、このスレッドの COM を初期化している。`items` の戻り値の COM のオブジェクトは、この関数の中だけで使う。
        let all = unsafe { items() }.map_err(|e| e.to_string())?;
        let (app, item) = all
            .into_iter()
            .find(|(a, _)| a.id == id)
            .ok_or_else(|| "not_found".to_string())?;
        let dest = crate::files::operations::unique_path(
            dir.join(format!("{}.lnk", safe_file_name(&app.name))),
        );
        let wide: Vec<u16> = dest
            .to_string_lossy()
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();
        // SAFETY: `_com` が COM を初期化している。`wide` は、呼び出しの間、生きていて、0 で終わる。`pidl` は、`SetIDList` のあとで、必ず `CoTaskMemFree` で解放する。
        unsafe {
            let link: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER)
                .map_err(|e| e.to_string())?;
            let pidl = SHGetIDListFromObject(&item).map_err(|e| e.to_string())?;
            let set = link.SetIDList(pidl);
            CoTaskMemFree(Some(pidl as _));
            set.map_err(|e| e.to_string())?;
            let file: IPersistFile = link.cast().map_err(|e| e.to_string())?;
            file.Save(PCWSTR(wide.as_ptr()), true)
                .map_err(|e| e.to_string())?;
        }
        Ok(dest)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn file_names_are_made_safe() {
        assert_eq!(safe_file_name("Microsoft Edge"), "Microsoft Edge");
        assert_eq!(safe_file_name("a/b:c*d?"), "a b c d");
        assert_eq!(safe_file_name("  ...  "), "App");
        assert_eq!(safe_file_name(""), "App");
        assert_eq!(safe_file_name("名前."), "名前");
        assert_eq!(safe_file_name(&"あ".repeat(300)).chars().count(), 100);
    }

    #[test]
    fn list_is_sorted_without_duplicates() {
        let app = |n: &str, i: &str| StartApp {
            name: n.into(),
            id: i.into(),
        };
        let out = tidy(vec![
            app("b", "2"),
            app("A", "1"),
            app("A", "1"),
            app("", "3"),
            app("c", ""),
        ]);
        assert_eq!(out, vec![app("A", "1"), app("b", "2")]);
    }

    /// 手で確かめる用(`cargo test manual_dump -- --ignored --nocapture`): 一覧の先頭と、電卓のショートカットの作成先を表示する。
    #[cfg(windows)]
    #[test]
    #[ignore]
    fn manual_dump() {
        let apps = list().unwrap();
        eprintln!("count={}", apps.len());
        for a in apps.iter().take(12) {
            eprintln!("{} | {}", a.name, a.id);
        }
        let dir = std::env::temp_dir().join("alumi-start-manual");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        for a in apps.iter().filter(|a| {
            a.name.contains("電卓") || a.name.contains("Calculator") || a.name.contains("メモ帳")
        }) {
            let lnk = create_shortcut(&a.id, &dir).unwrap();
            eprintln!("LNK {}", lnk.display());
            // ホームのアイコンと同じ方法(icon_png)で、アイコンを取り出して、PNG にする
            let png = crate::platform::icon::icon_png(&lnk.to_string_lossy());
            eprintln!("ICON {:?} bytes", png.as_ref().map(|p| p.len()));
            if let Some(p) = png {
                std::fs::write(lnk.with_extension("png"), p).unwrap();
            }
        }
    }

    /// 実際の Windows で、スタートメニューのアプリを読み、ショートカットを作れるか(Windows だけ)。
    #[cfg(windows)]
    #[test]
    fn real_start_apps_can_be_listed_and_copied() {
        let apps = list().expect("一覧を読める");
        assert!(!apps.is_empty(), "アプリが 1 つ以上ある");
        let dir = std::env::temp_dir().join(format!("alumi-start-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let first = &apps[0];
        let path = create_shortcut(&first.id, &dir).expect("ショートカットを作れる");
        assert!(path.is_file() && std::fs::metadata(&path).unwrap().len() > 0);
        assert!(create_shortcut("shell:AppsFolder\\no.such.app!x", &dir).is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
