//! 画素(RGBA)の加工: 絵の部分の切り出し・縮小・なめらかな拡大・PNG にする。
//! Windows の機能を使わない、純粋な計算(`mod.rs` が、取り出したアイコンの画素を、ここへ渡す)。

/// 大きなキャンバスの中央に小さく描かれたアイコン(48px や 32px の ico を 256px の枠に置いたもの)から、
/// 絵の部分(アルファが閾値を超える範囲)だけを切り出して、正方形にする。余白が小さい通常のアイコンは、そのまま返す。
///
/// # 引数
/// * `rgba` - RGBA(1 画素 4 バイト)の画像データ
/// * `w`, `h` - 画像の幅と高さ
///
/// # 戻り値
/// (正方形の RGBA データ, 一辺の長さ)
pub(super) fn crop_to_square(rgba: &[u8], w: u32, h: u32) -> (Vec<u8>, u32) {
    const THRESHOLD: u8 = 24;
    let (mut x0, mut y0, mut x1, mut y1) = (w, h, 0u32, 0u32);
    for y in 0..h {
        for x in 0..w {
            if rgba[((y * w + x) * 4 + 3) as usize] > THRESHOLD {
                x0 = x0.min(x);
                y0 = y0.min(y);
                x1 = x1.max(x);
                y1 = y1.max(y);
            }
        }
    }
    if x1 < x0 || y1 < y0 {
        return (rgba.to_vec(), w.max(h));
    }
    let (bw, bh) = (x1 - x0 + 1, y1 - y0 + 1);
    let side = bw.max(bh);
    // 余白が小さい(=通常のアイコン)ときは何もしない
    if side + side / 8 >= w.min(h) {
        return if w == h {
            (rgba.to_vec(), w)
        } else {
            place(rgba, w, x0, y0, bw, bh, w.max(h))
        };
    }
    place(rgba, w, x0, y0, bw, bh, side)
}

/// 画像の一部(`x0,y0` から `bw` x `bh`)を、`side` x `side` の透明な正方形の中央に置く。
///
/// # 引数
/// * `rgba` - 元の RGBA 画像
/// * `w` - 元の画像の幅
/// * `x0`, `y0` - 切り出す範囲の左上
/// * `bw`, `bh` - 切り出す範囲の幅と高さ
/// * `side` - 出力する正方形の一辺(`bw`・`bh` 以上であること)
///
/// # 戻り値
/// (正方形の RGBA データ, `side`)
pub(super) fn place(
    rgba: &[u8],
    w: u32,
    x0: u32,
    y0: u32,
    bw: u32,
    bh: u32,
    side: u32,
) -> (Vec<u8>, u32) {
    let mut out = vec![0u8; (side * side * 4) as usize];
    let ox = (side - bw) / 2;
    let oy = (side - bh) / 2;
    for y in 0..bh {
        let src = (((y0 + y) * w + x0) * 4) as usize;
        let dst = (((oy + y) * side + ox) * 4) as usize;
        out[dst..dst + (bw * 4) as usize].copy_from_slice(&rgba[src..src + (bw * 4) as usize]);
    }
    (out, side)
}

/// アイコンの PNG の一辺の上限(px)。Windows が出せる最大(256px)をそのまま使う。
/// 表示は約 130px(CSS)だが、画面の拡大率が 150% なら 195px 要るので、128px に縮めると、ぼやける。
pub(super) const MAX_SIDE: u32 = 256;
/// 絵の部分の一辺が、これ(px)より小さいアイコンは、`UPSCALE_TO` まで、なめらかに拡大する。
pub(super) const UPSCALE_BELOW: u32 = 128;
pub(super) const UPSCALE_TO: u32 = 192;
/// プレビューは、アイコンより少し大きく残す(写真は細かいので)
pub(super) const THUMB_SIDE: u32 = 192;

/// 正方形の RGBA 画像を、面積平均で縮小する。アルファで重みを付けて平均するので、透明部分の色が縁ににじまない。
///
/// # 引数
/// * `src` - 元の画像(一辺 `sw` の正方形)
/// * `sw` - 元の一辺
/// * `dw` - 縮小後の一辺(`sw` 以下)
///
/// # 戻り値
/// 一辺 `dw` の RGBA データ
pub(super) fn downscale(src: &[u8], sw: u32, dw: u32) -> Vec<u8> {
    let mut out = vec![0u8; (dw * dw * 4) as usize];
    let scale = sw as f32 / dw as f32;
    for dy in 0..dw {
        let (y0, y1) = (
            (dy as f32 * scale) as u32,
            (((dy + 1) as f32 * scale).ceil() as u32).min(sw),
        );
        for dx in 0..dw {
            let (x0, x1) = (
                (dx as f32 * scale) as u32,
                (((dx + 1) as f32 * scale).ceil() as u32).min(sw),
            );
            let (mut r, mut g, mut b, mut a, mut n) = (0u32, 0u32, 0u32, 0u32, 0u32);
            for y in y0..y1.max(y0 + 1) {
                for x in x0..x1.max(x0 + 1) {
                    let i = ((y.min(sw - 1) * sw + x.min(sw - 1)) * 4) as usize;
                    let al = src[i + 3] as u32;
                    r += src[i] as u32 * al;
                    g += src[i + 1] as u32 * al;
                    b += src[i + 2] as u32 * al;
                    a += al;
                    n += 1;
                }
            }
            let o = ((dy * dw + dx) * 4) as usize;
            if let (Some(r), Some(g), Some(b), Some(al)) = (
                r.checked_div(a),
                g.checked_div(a),
                b.checked_div(a),
                a.checked_div(n),
            ) {
                out[o] = r as u8;
                out[o + 1] = g as u8;
                out[o + 2] = b as u8;
                out[o + 3] = al as u8;
            }
        }
    }
    out
}

/// Mitchell-Netravali(B = C = 1/3)の重み。バイキュービックの一種で、ギザギザ(階段)を抑えつつ、輪郭のまわりの縁取り(リンギング)も出にくい。
fn mitchell(x: f32) -> f32 {
    const B: f32 = 1.0 / 3.0;
    const C: f32 = 1.0 / 3.0;
    let x = x.abs();
    if x < 1.0 {
        ((12.0 - 9.0 * B - 6.0 * C) * x * x * x
            + (-18.0 + 12.0 * B + 6.0 * C) * x * x
            + (6.0 - 2.0 * B))
            / 6.0
    } else if x < 2.0 {
        ((-B - 6.0 * C) * x * x * x
            + (6.0 * B + 30.0 * C) * x * x
            + (-12.0 * B - 48.0 * C) * x
            + (8.0 * B + 24.0 * C))
            / 6.0
    } else {
        0.0
    }
}

/// 正方形の RGBA 画像を、バイキュービック(Mitchell)で、なめらかに拡大する。
/// 色は、アルファを掛けた(premultiplied)状態で補間するので、透明な縁に、黒や白のにじみが出ない。
///
/// # 引数
/// * `src` - 元の画像(一辺 `sw` の正方形)
/// * `sw` - 元の一辺
/// * `dw` - 拡大後の一辺(`sw` 以上)
///
/// # 戻り値
/// 一辺 `dw` の RGBA データ
pub(super) fn upscale(src: &[u8], sw: u32, dw: u32) -> Vec<u8> {
    let scale = sw as f32 / dw as f32;
    // 出力の 1 列(1 行)ごとに、元の画像の 4 つの位置(先頭の位置, 重み)を前もって決める
    let taps: Vec<(i32, [f32; 4])> = (0..dw)
        .map(|d| {
            let s = (d as f32 + 0.5) * scale - 0.5;
            let i = s.floor();
            let mut w = [0.0f32; 4];
            for (k, wk) in w.iter_mut().enumerate() {
                *wk = mitchell(k as f32 - 1.0 - (s - i));
            }
            (i as i32 - 1, w)
        })
        .collect();
    let at = |x: i32, y: i32| {
        let (x, y) = (
            x.clamp(0, sw as i32 - 1) as u32,
            y.clamp(0, sw as i32 - 1) as u32,
        );
        ((y * sw + x) * 4) as usize
    };
    let mut out = vec![0u8; (dw * dw * 4) as usize];
    for (dy, (y0, wy)) in taps.iter().enumerate() {
        for (dx, (x0, wx)) in taps.iter().enumerate() {
            let (mut r, mut g, mut b, mut a) = (0.0f32, 0.0f32, 0.0f32, 0.0f32);
            for (ky, wyk) in wy.iter().enumerate() {
                for (kx, wxk) in wx.iter().enumerate() {
                    let i = at(x0 + kx as i32, y0 + ky as i32);
                    let wt = wxk * wyk;
                    let al = src[i + 3] as f32 / 255.0;
                    r += src[i] as f32 * al * wt;
                    g += src[i + 1] as f32 * al * wt;
                    b += src[i + 2] as f32 * al * wt;
                    a += al * wt;
                }
            }
            let a = a.clamp(0.0, 1.0);
            if a > 0.0 {
                let o = (dy * dw as usize + dx) * 4;
                out[o] = (r / a).clamp(0.0, 255.0).round() as u8;
                out[o + 1] = (g / a).clamp(0.0, 255.0).round() as u8;
                out[o + 2] = (b / a).clamp(0.0, 255.0).round() as u8;
                out[o + 3] = (a * 255.0).round() as u8;
            }
        }
    }
    out
}

/// RGBA の画素データを、PNG(圧縮は速さ優先)にする。
///
/// # 引数
/// * `rgba` - RGBA(1 画素 4 バイト)の画素データ
/// * `w`, `h` - 画像の幅と高さ
///
/// # 戻り値
/// PNG のバイト列。エンコードに失敗したら `None`
pub(super) fn encode_png(rgba: &[u8], w: u32, h: u32) -> Option<Vec<u8>> {
    let mut out = Vec::new();
    {
        let mut enc = png::Encoder::new(&mut out, w, h);
        enc.set_color(png::ColorType::Rgba);
        enc.set_depth(png::BitDepth::Eight);
        enc.set_compression(png::Compression::Fast);
        let mut writer = enc.write_header().ok()?;
        writer.write_image_data(rgba).ok()?;
    }
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 一辺 `n` の RGBA 画像。中の `inner` 四方(中央)が `color` で、まわりは透明。
    fn square(n: u32, inner: u32, color: [u8; 4]) -> Vec<u8> {
        let lo = (n - inner) / 2;
        (0..n * n)
            .flat_map(|i| {
                let (x, y) = (i % n, i / n);
                if (lo..lo + inner).contains(&x) && (lo..lo + inner).contains(&y) {
                    color
                } else {
                    [0, 0, 0, 0]
                }
            })
            .collect()
    }

    #[test]
    fn upscale_keeps_colors_and_does_not_bleed_into_transparent_edges() {
        let src = square(48, 32, [200, 30, 60, 255]);
        let out = upscale(&src, 48, 192);
        assert_eq!(out.len(), 192 * 192 * 4);
        let at = |x: usize, y: usize| &out[(y * 192 + x) * 4..][..4];
        // 中央は元の色のまま
        assert_eq!(at(96, 96), &[200, 30, 60, 255]);
        // 四隅は透明のまま
        assert_eq!(at(2, 2)[3], 0);
        // 縁の画素は、半透明でも、色は元の色(黒や白のにじみがない)
        let edge = (0..192).map(|x| at(x, 96)).find(|p| p[3] > 0 && p[3] < 255);
        if let Some(p) = edge {
            assert!(p[0] > 180 && p[1] < 50, "縁の色がにじんでいない: {p:?}");
        }
    }
}
