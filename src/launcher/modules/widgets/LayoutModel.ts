import { clamp } from "../../shared/lib/MathUtil";
import { widgetKey, type ModWidget } from "../../shared/api/ApiModel";
import { widgetPlugins } from "../plugins/PluginRegistry";

/**
 * ウィジェットを並べる欄(上のヘッダー / 下のフッター)。
 * ヘッダー・フッターは、横に 7 マスに区切られている(左から 1〜7、中心は 4)。マスは、アイコンと同じ**正方形**。
 * ウィジェットは、開始のマス(col)と幅(span = マスの数)で置き、重ならない。高さも、マスの数(rows)で決まる。
 */
export type BarId = "header" | "footer";
/** ヘッダー・フッターを横に区切るマスの数。 */
export const COLS = 7;
/** ウィジェットの置き場所: `[開始のマス(1〜7), 幅(マスの数)]`。 */
export type Placement = [number, number];

/**
 * ウィジェットごとの幅の範囲(マスの数)と、置いたときの標準の幅。
 * 標準は、中心の 4 マス目にぴったり置けるように、奇数にしてある。
 * `min` 最小の幅 / `max` 最大の幅 / `def` 標準の幅
 */
export interface CellRule {
  min: number;
  max: number;
  def: number;
}
/** マスとマスの間のすきま(px)。横も縦も同じ。 */
export const GAP = 4;
/** マスの 1 辺の下限(px)。ウィンドウがとても狭くても、これより小さくはしない。 */
const MIN_SIDE = 12;

/** マスの 1 辺(px)。**固定**で、設定のアイコンの大きさや、ウィンドウの大きさでは、変わらない。 */
export const CELL_SIDE = 44;

/**
 * マスの 1 辺(px)を求める。ふだんは固定(`CELL_SIDE`)。ウィンドウが狭くて、7 マスが収まらないときだけ、収まる大きさまで縮める。
 * @param contentWidth 欄の幅(余白を除く)
 * @returns 1 辺(px、整数)
 */
export function cellSide(contentWidth: number): number {
  const fit = Math.floor((contentWidth - (COLS - 1) * GAP) / COLS);
  return Math.max(MIN_SIDE, Math.min(fit, CELL_SIDE));
}

/**
 * 縦に `rows` マスぶんの高さ(px)。マスの間のすきまも含む。
 * @param rows 縦のマスの数
 * @param side マスの 1 辺
 */
export const rowsToPx = (rows: number, side: number) => rows * side + (rows - 1) * GAP;

/** ウィジェットの高さ(縦のマスの数): 小。 */
export const ROWS_SMALL = 1;
/** ウィジェットの高さ(縦のマスの数): 標準。 */
export const ROWS_STANDARD = 2;
/** ウィジェットの高さ(縦のマスの数): 大。選べる高さは、小・標準・大の 3 つだけ。 */
export const ROWS_LARGE = 3;

/**
 * ヘッダー・フッターの縦のマスの数を決める。小は 1 マス、標準は 2 マス、大は 3 マス(ヘッダー・フッターを右クリックして選ぶ)。
 * 欄のウィジェットは、すべて、この高さになる。中身は、ウィジェット自身が、高さに合わせて切り替える(1 マスでは、いちばん大事なところだけ出す、など)。
 * @param wanted 選ばれた高さ(`ROWS_SMALL` なら小、`ROWS_LARGE` なら大。それ以外・未選択は標準)
 * @returns 縦のマスの数
 */
export function rowsFor(wanted: number | undefined): number {
  return wanted === ROWS_SMALL ? ROWS_SMALL : wanted === ROWS_LARGE ? ROWS_LARGE : ROWS_STANDARD;
}

/**
 * 画面の x 座標から、欄の何マス目(1〜7)かを求める。マスは欄の中央に寄せて並ぶ。
 * @param x 画面の x 座標
 * @param contentLeft 欄の内側の左端(余白を除く)
 * @param contentWidth 欄の内側の幅
 * @param side マスの 1 辺
 * @returns マス(1〜7)。欄の外でも、いちばん近いマス
 */
export function colAtX(x: number, contentLeft: number, contentWidth: number, side: number): number {
  const total = COLS * side + (COLS - 1) * GAP;
  const start = contentLeft + (contentWidth - total) / 2;
  return clamp(Math.floor((x - start) / (side + GAP)) + 1, 1, COLS);
}

/** 追加ウィジェットの標準の幅を決めるときの、1 マスの目安(px)。`widget.json` の `width` から、マスの数へ換算する。 */
const MOD_CELL_PX = 60;

/**
 * ウィジェットの幅の規則(最小・最大・標準)を求める。
 * 優先順位: `widget.json` の `cells` → 組み込みウィジェットが登録した既定 → 追加ウィジェットの `width` から換算した標準。
 * @param id ウィジェット ID(`clock` / `mod:<名前>` / `mini:<ミニアプリ>/<名前>` など)
 * @param mods 追加ウィジェットの一覧
 * @returns 幅の規則
 */
export function ruleFor(id: string, mods: ModWidget[]): CellRule {
  const m = mods.find((x) => widgetKey(x) === id);
  // widget.json の cells([最小, 最大, 標準])があれば、それを使う
  if (m && m.cells[0] >= 1) return { min: m.cells[0], max: m.cells[1], def: m.cells[2] };
  const cells = widgetPlugins[id]?.cells; // 組み込みウィジェットが登録した既定(一覧を読み終えるまでの仮の値)
  if (cells) return { min: cells[0], max: cells[1], def: cells[2] };
  const def = m ? Math.min(COLS, Math.max(1, Math.round(m.width / MOD_CELL_PX))) : 3;
  return { min: 1, max: COLS, def };
}

/**
 * 設定(`widgetCells`)のキーを作る。
 * @param bar 欄(header / footer)
 * @param id ウィジェット ID
 * @returns `"header:clock"` のような文字列
 */
const cellKey = (bar: BarId, id: string) => `${bar}:${id}`;

/**
 * その場所(`col` から `span` マス)が、盤面に収まっていて、空いているか。
 * @param occ 各マスが埋まっているか(長さ 7)
 * @param col 開始のマス(1〜7)
 * @param span 幅(マスの数)
 */
const fits = (occ: boolean[], col: number, span: number) => {
  if (col < 1 || span < 1 || col + span - 1 > COLS) return false;
  for (let i = 0; i < span; i++) if (occ[col + i - 1]) return false;
  return true;
};
/**
 * いまの配置から、各マスが埋まっているかの表を作る。
 * @param layout 配置(ID → 置き場所)
 * @param except この ID のウィジェットは、無いものとして数える(動かすウィジェット自身を除くため)
 * @returns 長さ 7 の配列
 */
const occupancy = (layout: Map<string, Placement>, except?: string) => {
  const occ = new Array<boolean>(COLS).fill(false);
  for (const [id, [c, s]] of layout) if (id !== except) for (let i = 0; i < s; i++) occ[c + i - 1] = true;
  return occ;
};

/**
 * 空いている場所のうち、`want` のマスに一番近い開始位置を探す(`want` の左右へ、近い順に広げて探す)。
 * @param occ 各マスが埋まっているかの表
 * @param span 置きたい幅
 * @param want 置きたい開始のマス
 * @returns 開始のマス。置ける場所がなければ `null`
 */
export function findSlot(occ: boolean[], span: number, want: number): number | null {
  // want から、左右に 1 マスずつ広げながら(d = 0, 1, 2 …)、最初に収まる場所を返す。同じ距離なら、左を先に調べる
  for (let d = 0; d < COLS; d++) {
    for (const c of d === 0 ? [want] : [want - d, want + d]) if (fits(occ, c, span)) return c;
  }
  return null;
}

/**
 * ウィジェットを `want` のあたりに、幅 `span` で置けるか調べる。置けなければ、幅を(最小まで)縮めて探す。
 * @param layout いまの配置
 * @param id 置くウィジェット
 * @param want 置きたい開始のマス
 * @param span 置きたい幅
 * @param rule そのウィジェットの幅の規則
 * @returns 置けるなら `[開始, 幅]`、置けなければ `null`
 */
export function placeNear(
  layout: Map<string, Placement>,
  id: string,
  want: number,
  span: number,
  rule: CellRule,
): Placement | null {
  const occ = occupancy(layout, id);
  for (let s = clamp(span, rule.min, rule.max); s >= rule.min; s--) {
    const c = findSlot(occ, s, clamp(want, 1, COLS - s + 1));
    if (c !== null) return [c, s];
  }
  return null;
}

/**
 * 幅だけを変える(開始位置は、なるべく動かさない)。幅を縮めてごまかしたりはしない。
 * @param layout いまの配置
 * @param id 幅を変えるウィジェット
 * @param span 新しい幅
 * @param rule そのウィジェットの幅の規則
 * @returns 変えられるなら `[開始, 幅]`、範囲外・置けないなら `null`
 */
export function resizeTo(layout: Map<string, Placement>, id: string, span: number, rule: CellRule): Placement | null {
  if (span < rule.min || span > rule.max) return null;
  const cur = layout.get(id);
  const occ = occupancy(layout, id);
  const c = findSlot(occ, span, clamp(cur?.[0] ?? 1, 1, COLS - span + 1));
  return c === null ? null : [c, span];
}

/**
 * 並んでいるウィジェットの、実際の置き場所を決める。
 * 保存してある場所が正しく、重ならないものは、そのまま使う。保存がない・使えないものは、標準の幅で空いている所へ置く(最初の 1 つは、中心に置く)。どこにも置けないものは含めない(表示されない)。
 * @param bar 欄
 * @param ids 並べるウィジェットの ID(並び順)
 * @param saved 保存してある置き場所(設定の `widgetCells`)
 * @param rules ID から幅の規則を求める関数
 * @returns ID → 置き場所
 */
export function resolveLayout(
  bar: BarId,
  ids: string[],
  saved: Record<string, Placement | undefined>,
  rules: (id: string) => CellRule,
): Map<string, Placement> {
  const out = new Map<string, Placement>();
  const occ = new Array<boolean>(COLS).fill(false);
  const take = (id: string, c: number, s: number) => {
    out.set(id, [c, s]);
    for (let i = 0; i < s; i++) occ[c + i - 1] = true;
  };
  for (const id of ids) {
    const p = saved[cellKey(bar, id)];
    const r = rules(id);
    if (p && Array.isArray(p) && p[1] >= r.min && p[1] <= r.max && fits(occ, p[0], p[1])) take(id, p[0], p[1]);
  }
  for (const id of ids) {
    if (out.has(id)) continue;
    const r = rules(id);
    for (let s = r.def; s >= r.min; s--) {
      const want = out.size === 0 ? Math.floor((COLS - s) / 2) + 1 : 1;
      const c = findSlot(occ, s, want);
      if (c !== null) {
        take(id, c, s);
        break;
      }
    }
  }
  return out;
}

/**
 * 欄の置き場所を、設定(`widgetCells`)の形へ戻す。その欄の古い項目は、置き換える(別の欄のものは残す)。
 * @param bar 欄
 * @param base 元の設定の値
 * @param layout その欄の新しい配置
 * @returns 新しい設定の値
 */
export function cellsWith(
  bar: BarId,
  base: Record<string, Placement>,
  layout: Map<string, Placement>,
): Record<string, Placement> {
  const next: Record<string, Placement> = {};
  for (const [k, v] of Object.entries(base)) if (!k.startsWith(`${bar}:`)) next[k] = v;
  for (const [id, p] of layout) next[cellKey(bar, id)] = p;
  return next;
}
