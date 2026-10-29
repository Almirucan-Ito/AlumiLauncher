//! アプリのアイコンを、デスクトップやエクスプローラーのフォルダへドラッグして移動する(Windows 標準のドラッグ&ドロップ)。

use windows::core::HSTRING;
use windows::Win32::Foundation::HWND;
use windows::Win32::System::Com::IDataObject;
use windows::Win32::System::Ole::{OleInitialize, DROPEFFECT, DROPEFFECT_MOVE};
use windows::Win32::UI::Shell::{
    BHID_DataObject, IShellItem, IShellItemArray, SHCreateItemFromParsingName,
    SHCreateShellItemArrayFromShellItem, SHDoDragDrop,
};

/// ファイルの OS 標準のデータオブジェクト(エクスプローラーのファイルと同じ形式 = CF_HDROP を持つ)を作る。
/// ドラッグ&ドロップの「運ぶ中身」として、シェルに渡すために使う。
///
/// # 引数
/// * `path` - ドラッグするファイルの絶対パス
///
/// # 戻り値
/// データオブジェクト。ファイルが無い・作れないときは `None`
fn data_object(path: &str) -> Option<IDataObject> {
    // SAFETY: 渡すのは、この関数の中の `HSTRING`(呼び出しの間、生きている)と、COM のオブジェクトだけ。得た COM のオブジェクトは、持ち主(`windows` の型)が解放する。
    unsafe {
        let item: IShellItem = SHCreateItemFromParsingName(&HSTRING::from(path), None).ok()?;
        let array: IShellItemArray = SHCreateShellItemArrayFromShellItem(&item).ok()?;
        array.BindToHandler(None, &BHID_DataObject).ok()
    }
}

/// `path` のファイルを、マウスの左ボタンを押している間、ドラッグする(Esc で中止)。
/// 離した先(デスクトップ・エクスプローラーのフォルダなど)が受け取れば、ファイルは「移動」される。
/// ドラッグの動き(ボタンを離したらドロップ・Esc で中止)は、シェル標準の `SHDoDragDrop` に任せる。
///
/// # 引数
/// * `path` - ドラッグ(移動)するファイルの絶対パス
///
/// # 戻り値
/// * `Ok(true)` - 離した先に受け取られ、移動された
/// * `Ok(false)` - 中止された、または受け取られなかった
/// * `Err(理由)` - データオブジェクトを作れなかった、またはドラッグ自体に失敗した
pub fn drag_file_out(path: &str) -> Result<bool, String> {
    // SAFETY: OLE をこのスレッドで初期化してから、シェル標準のドラッグを呼ぶ(ドラッグが終わるまで戻らない)。`data` は、この中で作り、この中で解放される。
    unsafe {
        let _ = OleInitialize(None);
        let data = data_object(path).ok_or_else(|| "data object".to_string())?;
        // ドラッグ元の動作(ボタンを離したらドロップ・Esc で中止)は、シェル標準のものに任せる
        let effect: DROPEFFECT = SHDoDragDrop(HWND::default(), &data, None, DROPEFFECT_MOVE)
            .map_err(|e| e.to_string())?;
        Ok(effect.0 & DROPEFFECT_MOVE.0 != 0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use windows::Win32::System::Com::{DVASPECT_CONTENT, FORMATETC, TYMED_HGLOBAL};

    #[test]
    fn a_file_becomes_a_standard_shell_data_object() {
        let dir = std::env::temp_dir().join(format!("alumi-drag-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("a.txt");
        std::fs::write(&file, "x").unwrap();
        crate::platform::icon::ensure_com();
        let data = data_object(&file.to_string_lossy());
        let ok = data.as_ref().map(|d| {
            // CF_HDROP(15): エクスプローラーやデスクトップが、ファイルとして受け取る形式
            let fmt = FORMATETC {
                cfFormat: 15,
                ptd: std::ptr::null_mut(),
                dwAspect: DVASPECT_CONTENT.0,
                lindex: -1,
                tymed: TYMED_HGLOBAL.0 as u32,
            };
            // SAFETY: `fmt` は、この中の変数で、呼び出しの間、生きている(`ptd` は空)。
            unsafe { d.QueryGetData(&fmt).is_ok() }
        });
        let _ = std::fs::remove_dir_all(&dir);
        assert_eq!(ok, Some(true), "ファイルとして渡せるデータが作れる");
    }
}
