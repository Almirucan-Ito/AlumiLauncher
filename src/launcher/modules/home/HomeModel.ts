import { type FolderEntry, type Item } from "../../shared/api/ApiModel";

/** ホームに並ぶもの: フォルダ(`folder`)、または launcherFolder に保存したショートカットを、直接アイコンとして(`item`)。`slot` は、フォルダ内からアイコンを持ち出して置く位置に作る空き(描画だけに使い、並びのデータには入れない)。 */
export type HomeEntry = { kind: "folder"; folder: FolderEntry } | { kind: "item"; item: Item } | { kind: "slot" };

/** ホームの並び順を `orders` に保存するときのキー(Rust 側 `files/listing.rs` の `HOME_ORDER_KEY` と同じ)。 */
export const HOME_ORDER_KEY = "__home__"; // Rust 側(files/listing.rs)の HOME_ORDER_KEY と同じ

/**
 * ホームの項目の識別子を作る。
 * @param e ホームの項目
 * @returns フォルダは `"f:<ID>"`、ショートカットは `"i:<パス>"`、空きは `"slot"`
 */
export const entryKey = (e: HomeEntry) =>
  e.kind === "folder" ? `f:${e.folder.id}` : e.kind === "item" ? `i:${e.item.path}` : "slot";

/**
 * 並びの途中に、1 つ入れた新しい並びを作る(位置が後ろを超えるときは、一番後ろ)。
 * @param list いまの並び
 * @param index 入れる位置(`null` は、一番後ろ)
 * @param value 入れるもの
 * @returns 新しい並び(元の配列は変えない)
 */
export function insertClamped<T>(list: readonly T[], index: number | null, value: T): T[] {
  const next = list.slice();
  next.splice(index === null ? next.length : Math.max(0, Math.min(index, next.length)), 0, value);
  return next;
}

/**
 * ポインタの下のマスの番号を、ホームの項目の数で収める。
 * @param slot マスの番号(マスの外なら `null` / `undefined`)
 * @param len ホームの項目の数
 * @returns `0`〜`len`(マスの外は `len` = 一番後ろ)
 */
export function clampSlot(slot: number | null | undefined, len: number): number {
  return slot === null || slot === undefined ? len : Math.min(slot, len);
}

/** ホームのフォルダ 1 つの、画面の中での位置と大きさ。 */
export interface FolderRect {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * ホームのフォルダのうち、ポインタが中央に乗っているもの(そのまま入れられる)を探す。
 * @param folders ホームのフォルダの位置と大きさ
 * @param x ポインタの x 座標
 * @param y ポインタの y 座標
 * @param zone 中央とみなす広さ(大きさに対する割合。中心からの距離)
 * @param excludeId 除くフォルダの ID(いま開いているフォルダ)
 * @returns 見つかったフォルダ。なければ `null`
 */
export function folderUnderPoint(
  folders: readonly FolderRect[],
  x: number,
  y: number,
  zone: number,
  excludeId?: string,
): FolderRect | null {
  for (const f of folders) {
    if (f.id === excludeId) continue;
    const [cx, cy] = [f.left + f.width / 2, f.top + f.height / 2];
    if (Math.abs(x - cx) <= f.width * zone && Math.abs(y - cy) <= f.height * zone) return f;
  }
  return null;
}
