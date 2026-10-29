import { type FolderEntry, type Item } from "../../shared/api/ApiModel";
import { TUNING } from "../../shared/api/TuningModel";

/** フォルダを開く(閉じる)アニメーションの起点(画面の座標)。 */
export type Origin = { x: number; y: number };

/** いま開いているフォルダ(と、開くアニメーションの起点)。 */
export type OpenFolder = { folder: FolderEntry; origin: Origin };

/** フォルダ内で、ホームのアイコンを置く位置に作る、空きの印(中身のない仮のアイコン)。 */
export const SLOT_ITEM: Item = { name: "", path: "__slot__" };

/** フォルダ内のアイコンを、枠の外に出したまま止めてから、フォルダ内の画面を薄くするまでの時間(ms)。 */
export const LEAVE_DWELL_MS = TUNING.leaveDwellMs;

/** ホームのフォルダのアイコンに並べるマス数(3×3 の 9 個で固定)。 */
export const PREVIEW_SLOTS = 9;

/**
 * 保存してある並び順で、アイコンを並べ替える。並び順にないもの(新しく増えたもの)は、元の順のまま、いちばん後ろへ。
 * @param items アイコンの一覧
 * @param order 並び順(パスの一覧)
 * @returns 並べ替えた一覧
 */
export function applyOrder(items: Item[], order: string[] | undefined): Item[] {
  if (!order?.length) return items;
  const rank = new Map(order.map((p, i) => [p, i]));
  const big = order.length;
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => (rank.get(a.it.path) ?? big) - (rank.get(b.it.path) ?? big) || a.i - b.i)
    .map((x) => x.it);
}
