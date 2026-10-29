//! Windows シェルからファイル/ショートカットのアイコン(最大256px)を取り出して PNG にする。

use std::ffi::c_void;
use std::mem::size_of;
use std::path::Path;

mod pixels;

use pixels::{
    crop_to_square, downscale, encode_png, place, upscale, MAX_SIDE, THUMB_SIDE, UPSCALE_BELOW,
    UPSCALE_TO,
};
use windows::core::Interface;
use windows::core::HSTRING;
use windows::Win32::Foundation::{HWND, SIZE};
use windows::Win32::Graphics::Gdi::{
    DeleteObject, GetDC, GetDIBits, GetObjectW, ReleaseDC, BITMAP, BITMAPINFO, BITMAPINFOHEADER,
    BI_RGB, DIB_RGB_COLORS, HBITMAP, HGDIOBJ,
};
use windows::Win32::Storage::FileSystem::FILE_FLAGS_AND_ATTRIBUTES;
use windows::Win32::System::Com::{CoInitializeEx, COINIT_APARTMENTTHREADED};
use windows::Win32::UI::Controls::IImageList;
use windows::Win32::UI::Shell::{
    IShellItem, IShellItemImageFactory, SHCreateItemFromParsingName, SHGetFileInfoW,
    SHGetImageList, SHFILEINFOW, SHGFI_SYSICONINDEX, SIIGBF_BIGGERSIZEOK, SIIGBF_THUMBNAILONLY,
};
use windows::Win32::UI::WindowsAndMessaging::{DestroyIcon, GetIconInfo, HICON, ICONINFO};

/// システムのアイコン一覧の大きさの種類: 特大(256x256)。
const SHIL_JUMBO: i32 = 4; // 256x256
/// システムのアイコン一覧の大きさの種類: 大(48x48)。
const SHIL_EXTRALARGE: i32 = 2; // 48x48
/// アイコンを取り出すときのフラグ: 背景を透明にする。
const ILD_TRANSPARENT: u32 = 0x1;

thread_local! {
    static COM_READY: std::cell::Cell<bool> = const { std::cell::Cell::new(false) };
}

/// このスレッドで COM を一度だけ初期化する(呼ぶたびに初期化の回数が増えるのを避ける)。
/// シェルのアイコン・サムネイルの取得は、COM が必要なので、取得の前に必ず呼ぶ。
pub fn ensure_com() {
    COM_READY.with(|ready| {
        if !ready.get() {
            // SAFETY: 引数なしの COM の初期化。スレッドごとに一度だけ(`COM_READY`)。
            let _ = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) };
            ready.set(true);
        }
    });
}

/// ファイル/ショートカットのアイコンを取り出し、PNG(最大 256px 四方)にする。
/// システムのアイコン一覧(256px → 48px の順)から、取れた最初のものを使う。
///
/// # 引数
/// * `path` - アイコンを取り出す対象の絶対パス
///
/// # 戻り値
/// PNG のバイト列。アイコンを取り出せなかったときは `None`
pub fn icon_png(path: &str) -> Option<Vec<u8>> {
    ensure_com();
    // SAFETY: `ensure_com` で、このスレッドの COM は初期化済み。取り出した `HICON` は、使い終わったら、この中で必ず `DestroyIcon` する。`info` は、この中の変数で、渡す大きさは、その型の大きさ。
    unsafe {
        let wide = HSTRING::from(path);
        let mut info = SHFILEINFOW::default();
        let r = SHGetFileInfoW(
            &wide,
            FILE_FLAGS_AND_ATTRIBUTES(0),
            Some(&mut info as *mut SHFILEINFOW),
            size_of::<SHFILEINFOW>() as u32,
            SHGFI_SYSICONINDEX,
        );
        if r == 0 {
            return None;
        }

        // 大きいアイコンから順に試す
        for size in [SHIL_JUMBO, SHIL_EXTRALARGE] {
            let Ok(list) = SHGetImageList::<IImageList>(size) else {
                continue;
            };
            let Ok(hicon) = list.GetIcon(info.iIcon, ILD_TRANSPARENT) else {
                continue;
            };
            let png = hicon_to_png(hicon);
            let _ = DestroyIcon(hicon);
            if png.is_some() {
                return png;
            }
        }
        None
    }
}

/// 画像・動画か(エクスプローラーが、大きいアイコン表示で中身のプレビューを出す種類か)を、拡張子で判定する。
///
/// # 引数
/// * `path` - 判定するファイルのパス(拡張子の大文字・小文字は区別しない)
///
/// # 戻り値
/// 画像または動画の拡張子なら `true`
pub fn is_media(path: &str) -> bool {
    let ext = Path::new(path)
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    matches!(
        ext.as_str(),
        "jpg"
            | "jpeg"
            | "jfif"
            | "png"
            | "gif"
            | "bmp"
            | "webp"
            | "tif"
            | "tiff"
            | "heic"
            | "heif"
            | "avif"
            | "svg"
            | "mp4"
            | "m4v"
            | "mkv"
            | "avi"
            | "mov"
            | "wmv"
            | "webm"
            | "flv"
            | "mpg"
            | "mpeg"
            | "ts"
            | "3gp"
    )
}

/// 画像・動画のプレビュー(サムネイル)を、192px 以下の正方形の PNG にする。
/// 縦横の比率は保ち、正方形の中央に置く(余白は透明)。
///
/// # 引数
/// * `path` - プレビューを作る対象の絶対パス
///
/// # 戻り値
/// PNG のバイト列。中身のプレビューが作れないファイルは `None`(呼び出し側が、普通のアイコンにする)
pub fn thumbnail_png(path: &str) -> Option<Vec<u8>> {
    ensure_com();
    // SAFETY: `ensure_com` で、このスレッドの COM は初期化済み。得た `HBITMAP`(`hbmp`)は、この中だけで使い、最後に必ず `DeleteObject` する。`GetDC` で得た `hdc` も、使ったあとすぐ `ReleaseDC` する。
    unsafe {
        let item: IShellItem = SHCreateItemFromParsingName(&HSTRING::from(path), None).ok()?;
        let factory: IShellItemImageFactory = item.cast().ok()?;
        // THUMBNAILONLY: 中身のプレビューが作れないときは失敗にして、呼び出し側が普通のアイコンにする
        let hbmp = factory
            .GetImage(
                SIZE { cx: 256, cy: 256 },
                SIIGBF_THUMBNAILONLY | SIIGBF_BIGGERSIZEOK,
            )
            .ok()?;
        let result = (|| {
            let mut bmp = BITMAP::default();
            if GetObjectW(
                HGDIOBJ(hbmp.0),
                size_of::<BITMAP>() as i32,
                Some(&mut bmp as *mut BITMAP as *mut c_void),
            ) == 0
            {
                return None;
            }
            let (w, h) = (bmp.bmWidth, bmp.bmHeight);
            if w <= 0 || h <= 0 {
                return None;
            }
            let hdc = GetDC(HWND::default());
            let bits = read_bits(hdc, hbmp, w, h);
            ReleaseDC(HWND::default(), hdc);
            let mut px = bits?;
            for p in px.as_chunks_mut::<4>().0 {
                p.swap(0, 2); // BGRA -> RGBA
            }
            if px.as_chunks::<4>().0.iter().all(|p| p[3] == 0) {
                for p in px.as_chunks_mut::<4>().0 {
                    p[3] = 255; // アルファの無いビットマップ
                }
            } else {
                // 乗算済みアルファなら、元の色に戻す
                for p in px.as_chunks_mut::<4>().0 {
                    let a = p[3] as u32;
                    if a > 0 && a < 255 {
                        for c in &mut p[..3] {
                            *c = ((*c as u32 * 255) / a).min(255) as u8;
                        }
                    }
                }
            }
            // 縦横の比率はそのままに、正方形の中央に置く(余白は透明)
            let (w, h) = (w as u32, h as u32);
            let (px, side) = if w == h {
                (px, w)
            } else {
                place(&px, w, 0, 0, w, h, w.max(h))
            };
            let (px, side) = if side > THUMB_SIDE {
                (downscale(&px, side, THUMB_SIDE), THUMB_SIDE)
            } else {
                (px, side)
            };
            encode_png(&px, side, side)
        })();
        let _ = DeleteObject(HGDIOBJ(hbmp.0));
        result
    }
}
/// ビットマップの画素を、上から下の順に、32bit(BGRA)で読み出す。
///
/// # 引数
/// * `hdc` - 読み出しに使うデバイスコンテキスト
/// * `bmp` - 読み出すビットマップ
/// * `w`, `h` - ビットマップの幅と高さ(どちらも 1 以上)
///
/// # 戻り値
/// `w * h * 4` バイトの画素データ。読み出しに失敗したら `None`
///
/// # Safety
/// `hdc` と `bmp` は有効なハンドルであること
unsafe fn read_bits(
    hdc: windows::Win32::Graphics::Gdi::HDC,
    bmp: HBITMAP,
    w: i32,
    h: i32,
) -> Option<Vec<u8>> {
    let mut bi = BITMAPINFO {
        bmiHeader: BITMAPINFOHEADER {
            biSize: size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: w,
            biHeight: -h, // 上から下
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB.0,
            ..Default::default()
        },
        ..Default::default()
    };
    let mut buf = vec![0u8; (w * h * 4) as usize];
    let lines = GetDIBits(
        hdc,
        bmp,
        0,
        h as u32,
        Some(buf.as_mut_ptr() as *mut c_void),
        &mut bi,
        DIB_RGB_COLORS,
    );
    if lines == 0 {
        None
    } else {
        Some(buf)
    }
}

/// アイコンハンドルを、PNG にする。
/// 古いアイコン(アルファ情報が無いもの)は、マスクから透明部分を作る。
/// 大きな枠の中央に小さく描かれたものは、絵の部分だけを切り出し(`crop_to_square`)、上限(256px)を超えるときだけ縮小する。
///
/// # 引数
/// * `hicon` - アイコンのハンドル(解放は、呼び出し側が行う)
///
/// # 戻り値
/// PNG のバイト列。変換できなければ `None`
///
/// # Safety
/// `hicon` は有効なアイコンハンドルであること
unsafe fn hicon_to_png(hicon: HICON) -> Option<Vec<u8>> {
    let mut ii = ICONINFO::default();
    GetIconInfo(hicon, &mut ii).ok()?;

    let mut bmp = BITMAP::default();
    let got = GetObjectW(
        HGDIOBJ(ii.hbmColor.0),
        size_of::<BITMAP>() as i32,
        Some(&mut bmp as *mut BITMAP as *mut c_void),
    );

    let result = (|| {
        if got == 0 {
            return None;
        }
        let (w, h) = (bmp.bmWidth, bmp.bmHeight);
        if w <= 0 || h <= 0 {
            return None;
        }

        let hdc = GetDC(HWND::default());
        let color = read_bits(hdc, ii.hbmColor, w, h);
        let mask = if ii.hbmMask.0.is_null() {
            None
        } else {
            read_bits(hdc, ii.hbmMask, w, h)
        };
        ReleaseDC(HWND::default(), hdc);

        let mut px = color?;
        // BGRA -> RGBA
        for p in px.as_chunks_mut::<4>().0 {
            p.swap(0, 2);
        }
        // アルファ情報が無い古いアイコンはマスクから作る
        if px.as_chunks::<4>().0.iter().all(|p| p[3] == 0) {
            for (i, p) in px.as_chunks_mut::<4>().0.iter_mut().enumerate() {
                let transparent = mask.as_ref().map(|m| m[i * 4] != 0).unwrap_or(false);
                p[3] = if transparent { 0 } else { 255 };
            }
        }
        let (px, side) = crop_to_square(&px, w as u32, h as u32);
        // 上限(MAX_SIDE)より大きいときは縮小し、小さい(元のアプリが小さいアイコンしか持たない)ときは、
        // 画面に引き伸ばされてギザギザにならないよう、先に、なめらかに拡大しておく
        let (px, side) = if side > MAX_SIDE {
            (downscale(&px, side, MAX_SIDE), MAX_SIDE)
        } else if side < UPSCALE_BELOW {
            (upscale(&px, side, UPSCALE_TO), UPSCALE_TO)
        } else {
            (px, side)
        };
        encode_png(&px, side, side)
    })();

    if !ii.hbmColor.0.is_null() {
        let _ = DeleteObject(HGDIOBJ(ii.hbmColor.0));
    }
    if !ii.hbmMask.0.is_null() {
        let _ = DeleteObject(HGDIOBJ(ii.hbmMask.0));
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn media_files_are_detected_by_extension() {
        assert!(is_media("C:\\a\\photo.JPG") && is_media("C:\\a\\movie.mp4") && is_media("x.webp"));
        assert!(
            !is_media("C:\\a\\app.exe") && !is_media("C:\\a\\doc.txt") && !is_media("C:\\a\\noext")
        );
    }

    #[test]
    fn an_image_file_gets_a_preview_not_just_an_icon() {
        // 160x90(横長)の単色 PNG を作って、プレビューが縦横比を保ったまま正方形の中に収まることを確かめる
        let dir = std::env::temp_dir().join(format!("alumi-thumb-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("wide.png");
        let mut data = Vec::new();
        {
            let mut enc = png::Encoder::new(&mut data, 160, 90);
            enc.set_color(png::ColorType::Rgba);
            enc.set_depth(png::BitDepth::Eight);
            let mut w = enc.write_header().unwrap();
            let px: Vec<u8> = (0..160 * 90).flat_map(|_| [220u8, 40, 40, 255]).collect();
            w.write_image_data(&px).unwrap();
        }
        std::fs::write(&file, data).unwrap();
        let png_bytes = thumbnail_png(&file.to_string_lossy());
        let _ = std::fs::remove_dir_all(&dir);
        let png_bytes = png_bytes.expect("画像のプレビューが作れる");
        let decoder = png::Decoder::new(std::io::Cursor::new(png_bytes));
        let mut reader = decoder.read_info().unwrap();
        let mut buf = vec![0; reader.output_buffer_size()];
        let info = reader.next_frame(&mut buf).unwrap();
        assert_eq!(info.width, info.height, "正方形の中に置く");
        // 真ん中は赤い画像、上端は余白(透明)
        let at = |x: u32, y: u32| &buf[((y * info.width + x) * 4) as usize..][..4];
        let mid = at(info.width / 2, info.height / 2);
        assert!(mid[0] > 150 && mid[3] > 200, "中央は画像の色: {mid:?}");
        assert_eq!(
            at(info.width / 2, 1)[3],
            0,
            "横長の画像なので、上の端は透明な余白"
        );
    }
}
