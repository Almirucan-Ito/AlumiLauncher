import { TUNING } from "../api/TuningModel";

/**
 * 一覧(ページ送りのグリッド)の並べ方。
 * `mode` `"auto"`(画面サイズに合わせて表示数を調整)/ `"fixed"`(1 ページの表示数を指定)、`count` 固定のときの 1 ページの数、`size` アイコンの大きさ(px)、`gap` 間隔(px)、`compact` とても小さいウィンドウ用(ラベルを出さず、アイコンだけ詰めて並べる)
 */
export interface PagerLayout {
  mode: "auto" | "fixed";
  count: number;
  size: number;
  gap: number;
  /** とても小さいウィンドウ用: ラベルを出さず、アイコンだけを詰めて並べる */
  compact?: boolean;
}

/** アイコン 1 マスの横の大きさの比率(`styles.css` の `.page` と揃えること)。 */
const CELL_W = 1.45;
/** アイコン 1 マスの縦の大きさの比率(`styles.css` の `.page` と揃えること)。 */
const CELL_H = 1.35;
/** ラベルの分として、1 マスの高さに足す値(px)。 */
const CELL_H_EXTRA = 32;
/** compact(ラベル無し)のときの、1 マスの高さの比率(`styles.css` の `.app.compact .page` と揃えること)。 */
const CELL_H_COMPACT = 1.1;

/** 外部(別の一覧からのドラッグ)から、この一覧を操作する窓口。`go` はページ送り(+1 / -1)、`rect` は一覧の表示領域(画面の座標)。 */
export interface PagerApi {
  go: (d: number) => void;
  /** 一覧の表示領域(画面の座標) */
  rect: () => DOMRect | null;
}

/**
 * ほかの一覧からドラッグしてきたアイコンが、この一覧の左右の端(▷ ◁ の位置)に来たら、しばらく待ってからページを送る仕組みを作る。
 * 端に居続ける間は、一定の間隔で送り続ける。
 * @param getApi 送り先の一覧の窓口を返す関数
 * @returns `feed(x, y, active)`(ポインタの座標を渡し続ける)と `stop()`(止める)
 */
export function makeEdgeFlipper(getApi: () => PagerApi | null) {
  let timer: number | undefined;
  let dirNow = 0;
  const stop = () => {
    clearTimeout(timer);
    timer = undefined;
    dirNow = 0;
  };
  return {
    stop,
    feed(x: number, y: number, active: boolean) {
      const api = getApi();
      const r = api?.rect();
      let dir = 0;
      if (active && api && r && y >= r.top && y <= r.bottom) {
        if (x >= r.left - 40 && x < r.left + 60) dir = -1;
        else if (x <= r.right + 40 && x > r.right - 60) dir = 1;
      }
      if (dir === 0) return stop();
      if (dir !== dirNow) {
        stop();
        dirNow = dir;
        const tick = () => {
          getApi()?.go(dir);
          timer = window.setTimeout(tick, EDGE_FLIP_MS + 150);
        };
        timer = window.setTimeout(tick, EDGE_FLIP_MS);
      }
    },
  };
}

/**
 * 配列を、`n` 個ずつのページに分ける。
 * @param arr 分ける配列
 * @param n 1 ページの数
 * @returns ページの配列(空のときも、空のページが 1 つ)
 */
export function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out.length ? out : [[]];
}

// ドラッグ操作の感度は、TuningModel.ts にまとめてある(動きを調整したいときはそちらを書き換える)
/** ドラッグ操作の感度は、`TuningModel.ts` にまとめてある(調整したいときは、そちらを書き換える)。以下は、その値の別名。 */
export const LONG_PRESS_MS = TUNING.longPressMs;
export const EDGE_PX = TUNING.edgePx;
export const EDGE_FLIP_MS = TUNING.edgeFlipMs;
export const MERGE_DWELL_MS = TUNING.mergeDwellMs;
export const REORDER_DWELL_MS = TUNING.reorderDwellMs;
export const CENTER_SETTLE_MS = TUNING.centerSettleMs;
export const RIM_ZONE = TUNING.rimZone;
export const CENTER_ZONE = TUNING.centerZone;
export const FLIP_MS = TUNING.moveAnimationMs;
/** ドラッグ中のアイコンが、相手のマスのどこにいるか: `center`(中央 = 重ねる)/ `inner`(内側 = 入れ替え)/ `rim`(縁 = 何もしない)。 */
export type HoverZone = "center" | "inner" | "rim";

/**
 * ドラッグ中のアイコンが、相手のマスのどこにいるかを判定する。
 * @param fx マスの中の横の位置(0〜1)
 * @param fy マスの中の縦の位置(0〜1)
 * @param centerSize 中央とみなす広さ(中心からの距離。0.5 でマス全体)
 * @param mergeable 相手に重ねられるか(重ねられないときは、中央でも「重ねる」にしない)
 * @returns `center`(重ねる)/ `inner`(入れ替え)/ `rim`(何もしない)
 */
export function hoverZoneOf(fx: number, fy: number, centerSize: number, mergeable: boolean): HoverZone {
  const inCenter = Math.abs(fx - 0.5) < centerSize && Math.abs(fy - 0.5) < centerSize;
  const inInner = fx > RIM_ZONE && fx < 1 - RIM_ZONE && fy > RIM_ZONE && fy < 1 - RIM_ZONE;
  return mergeable && inCenter ? "center" : inInner ? "inner" : "rim";
}

/**
 * ドラッグしているものを、相手の位置へ入れ替えた並びを作る。
 * @param items いまの並び
 * @param getId 項目の ID を返す関数
 * @param dragId ドラッグしているものの ID
 * @param targetId 入れ替える相手の ID
 * @returns 新しい並び。入れ替えが要らないとき(どちらかが無い・同じ)は `null`
 */
export function reorderedItems<T>(
  items: readonly T[],
  getId: (item: T) => string | null,
  dragId: string,
  targetId: string,
): T[] | null {
  const from = items.findIndex((it) => getId(it) === dragId);
  const to = items.findIndex((it) => getId(it) === targetId);
  if (from < 0 || to < 0 || from === to) return null;
  const next = items.slice();
  const [m] = next.splice(from, 1);
  next.splice(to, 0, m);
  return next;
}

/** 一覧の矩形(画面の座標)。 */
export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * ドラッグ中のポインタが、一覧の左右の端に寄っているかを判定する(ページ送りの向き)。
 * @param x ポインタの x 座標
 * @param y ポインタの y 座標
 * @param rect 一覧の表示領域
 * @param band 端とみなすための枠(この中にいるときだけ有効。枠の外へ出しているときは送らない)
 * @param frozen Shift を押している間は `true`(送らない)
 * @returns `-1` 前のページへ / `1` 次のページへ / `0` 送らない
 */
export function edgeDirectionOf(x: number, y: number, rect: Box, band: Box, frozen: boolean): -1 | 0 | 1 {
  const inBand = y >= band.top && y <= band.bottom && x >= band.left && x <= band.right;
  if (!inBand || frozen) return 0;
  if (x < rect.left + EDGE_PX) return -1;
  if (x > rect.right - EDGE_PX) return 1;
  return 0;
}

/**
 * スワイプで引っ張った量から、送るページの数を決める。
 * @param dx 横に動かした量(px。左へ動かすと負)
 * @returns `1` 次のページへ(左へ 60px より大きく)/ `-1` 前のページへ(右へ)/ `0` 送らない
 */
export function swipePageDelta(dx: number): -1 | 0 | 1 {
  if (dx < -60) return 1;
  if (dx > 60) return -1;
  return 0;
}

/**
 * 端のページで、さらに外へ引っ張ったときに、ゴム紐のように抵抗を付ける。
 * @param dx 横に動かした量(px)
 * @param page 表示中のページ(0 から)
 * @param count ページの数
 * @returns 画面に反映する量(端の外向きなら 0.3 倍)
 */
export function withResistance(dx: number, page: number, count: number): number {
  return (page === 0 && dx > 0) || (page === count - 1 && dx < 0) ? dx * 0.3 : dx;
}

/** グリッドの列数・行数・1 ページの数。 */
export interface Grid {
  cols: number;
  rows: number;
  perPage: number;
}

/**
 * 表示領域の大きさと並べ方から、グリッドの列数・行数を求める。
 * 固定のときは、個数から正方形に近い形にする。自動のときは、アイコンの大きさと間隔から、収まる数を計算する(計測前は 3x3)。
 * @param layout 並べ方
 * @param w 表示領域の幅(px)
 * @param h 表示領域の高さ(px)
 * @returns グリッド
 */
export function computeGrid(layout: PagerLayout, w: number, h: number): Grid {
  if (layout.mode === "fixed") {
    const n = Math.max(1, Math.round(layout.count));
    const c = Math.ceil(Math.sqrt(n));
    return { cols: c, rows: Math.ceil(n / c), perPage: n };
  }
  if (!w || !h) return { cols: 3, rows: 3, perPage: 9 };
  const c = Math.max(1, Math.floor((w + layout.gap) / (layout.size * CELL_W + layout.gap)));
  const r = layout.compact
    ? Math.max(1, Math.floor((h + layout.gap) / (layout.size * CELL_H_COMPACT + layout.gap)))
    : Math.max(1, Math.floor((h + layout.gap) / (layout.size * CELL_H + CELL_H_EXTRA + layout.gap)));
  return { cols: c, rows: r, perPage: c * r };
}

/**
 * 画面の座標が、表示中のページの何番目のマスの上かを求める。マスの並び(グリッド)から計算する(動いている最中のアイコンの位置を使うと、アニメーション中に値がぶれて、入れ替えが行ったり来たりするため)。
 * フォルダ内の画面など、この一覧より手前にほかのものが重なっているときは `null`。
 * @param viewport 一覧の表示領域の要素
 * @param root 一覧全体の要素(この中の要素の上にあるときだけ、有効)
 * @param page 表示中のページ(0 から)
 * @param perPage 1 ページの数
 * @param x 画面の x 座標
 * @param y 画面の y 座標
 * @returns `index`(全体の通し番号)と、マスの中の位置 `fx` / `fy`(0〜1)。マスの外なら `null`
 */
export function cellAtPoint(
  viewport: HTMLElement | null,
  root: HTMLElement | null,
  page: number,
  perPage: number,
  x: number,
  y: number,
) {
  const pageEl = viewport?.querySelectorAll<HTMLElement>(".page")[page];
  if (!pageEl) return null;
  const top = document.elementFromPoint(x, y);
  if (top && !root?.contains(top)) return null;
  const cs = getComputedStyle(pageEl);
  const colW = cs.gridTemplateColumns.split(" ").map(parseFloat);
  const rowH = cs.gridTemplateRows.split(" ").map(parseFloat);
  const gapX = parseFloat(cs.columnGap) || 0;
  const gapY = parseFloat(cs.rowGap) || 0;
  if (!colW.length || !rowH.length || colW.some(Number.isNaN) || rowH.some(Number.isNaN)) return null;
  const totalW = colW.reduce((a, b) => a + b, 0) + gapX * (colW.length - 1);
  const totalH = rowH.reduce((a, b) => a + b, 0) + gapY * (rowH.length - 1);
  const pr = pageEl.getBoundingClientRect();
  // グリッドは .page の中央に置かれている(justify-content / align-content: center)
  const rx = x - (pr.left + (pr.width - totalW) / 2);
  const ry = y - (pr.top + (pr.height - totalH) / 2);
  if (rx < 0 || ry < 0 || rx > totalW || ry > totalH) return null;
  const stepX = colW[0] + gapX;
  const stepY = rowH[0] + gapY;
  const col = Math.min(colW.length - 1, Math.floor(rx / stepX));
  const row = Math.min(rowH.length - 1, Math.floor(ry / stepY));
  return {
    index: page * perPage + row * colW.length + col,
    fx: (rx - col * stepX) / colW[0], // マスの中の位置(0〜1)
    fy: (ry - row * stepY) / rowH[0],
  };
}
