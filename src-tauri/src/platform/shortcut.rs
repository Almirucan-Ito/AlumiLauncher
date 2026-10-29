//! ごみ箱への移動・プロパティなどのシェルの動詞と、Windowsのテーマカラー(アクセントカラー)の取得。

/// ファイルをごみ箱へ移動する(完全削除ではない。エクスプローラーの確認ダイアログも出さない)。
///
/// # 引数
/// * `path` - ごみ箱へ移すファイル(またはフォルダ)の絶対パス
///
/// # 戻り値
/// * `Ok(())` - 移動できた
/// * `Err(理由)` - 失敗した、または途中で中止された(シェルのエラーコードを含む文字列)
pub fn recycle(path: &str) -> Result<(), String> {
    use windows::core::PCWSTR;
    use windows::Win32::UI::Shell::{SHFileOperationW, SHFILEOPSTRUCTW};

    const FO_DELETE: u32 = 3;
    // FOF_SILENT | FOF_NOCONFIRMATION | FOF_ALLOWUNDO(ごみ箱へ) | FOF_NOERRORUI
    const FLAGS: u16 = 0x4 | 0x10 | 0x40 | 0x400;

    // pFrom は二重のヌル終端が必要
    let mut wide: Vec<u16> = path.encode_utf16().collect();
    wide.extend([0, 0]);
    let mut op = SHFILEOPSTRUCTW {
        wFunc: FO_DELETE,
        pFrom: PCWSTR(wide.as_ptr()),
        fFlags: FLAGS,
        ..Default::default()
    };
    // SAFETY: `op.pFrom` は、二重の 0 で終わる `wide`(この関数の中で、呼び出しのあとまで生きている)を指す。
    let code = unsafe { SHFileOperationW(&mut op) };
    if code != 0 || op.fAnyOperationsAborted.as_bool() {
        Err(format!("error code {code}"))
    } else {
        Ok(())
    }
}

/// ファイル(またはフォルダ)に、エクスプローラーの右クリックメニューと同じ「動詞」を実行する。
/// `"properties"` はプロパティの画面、`"openas"` は「プログラムから開く」(アプリを選ぶ画面)が出る。
///
/// # 引数
/// * `path` - 対象の絶対パス
/// * `verb` - 動詞(`"properties"` / `"openas"`)
///
/// # 戻り値
/// 画面を出せたら `Ok(())`(画面は、閉じられるのを待たない)。失敗したら理由
pub fn shell_verb(path: &str, verb: &str) -> Result<(), String> {
    use windows::core::{HSTRING, PCWSTR};
    use windows::Win32::UI::Shell::{ShellExecuteExW, SEE_MASK_INVOKEIDLIST, SHELLEXECUTEINFOW};
    use windows::Win32::UI::WindowsAndMessaging::SW_SHOW;

    let file = HSTRING::from(path);
    let verb = HSTRING::from(verb);
    let mut info = SHELLEXECUTEINFOW {
        cbSize: std::mem::size_of::<SHELLEXECUTEINFOW>() as u32,
        fMask: SEE_MASK_INVOKEIDLIST,
        lpVerb: PCWSTR(verb.as_ptr()),
        lpFile: PCWSTR(file.as_ptr()),
        nShow: SW_SHOW.0,
        ..Default::default()
    };
    // SAFETY: `info.lpVerb` と `info.lpFile` は、`verb` と `file`(この関数の中で、呼び出しのあとまで生きている)を指す。`cbSize` は構造体の大きさ。
    unsafe { ShellExecuteExW(&mut info) }.map_err(|e| e.to_string())
}

/// Windows のテーマカラー(アクセントカラー)を取得する。
///
/// # 戻り値
/// `"#rrggbb"` 形式の文字列。取得できない環境では `None`
pub fn accent_color() -> Option<String> {
    use windows::UI::ViewManagement::{UIColorType, UISettings};
    let ui = UISettings::new().ok()?;
    let c = ui.GetColorValue(UIColorType::Accent).ok()?;
    Some(format!("#{:02x}{:02x}{:02x}", c.R, c.G, c.B))
}
