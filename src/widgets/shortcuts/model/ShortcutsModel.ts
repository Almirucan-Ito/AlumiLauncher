import type { DropDetail } from "../../../launcher/modules/plugins/PluginModel";

/**
 * ショートカットウィジェットに入れておく 1 つ。ホームのアイコン(ファイル)か、フォルダか、ミニアプリ。
 * ミニアプリ(`mini`)は、ホームのアイコン(`.alumiapp`)ではなく、ミニアプリのフォルダ(`id` は、そのフォルダ名)を参照する。
 */
export type ShortcutEntry =
  | { kind: "item"; path: string; name: string }
  | { kind: "folder"; id: string; path: string; name: string }
  | { kind: "mini"; id: string; name: string };

/** 横に並べられるアイコンの数の上限(1 段あたり)。 */
export const MAX_PER_ROW = 6;
/** 入れておける数の上限(大: 2 段 × 6 個)。 */
export const MAX_SHORTCUTS = MAX_PER_ROW * 2;
/** アイコンの間のすきま(px)。 */
export const ICON_GAP = 4;
/** 保存するときのキー名(ウィジェットの `data` フォルダの `list.txt`)。 */
export const SHORTCUTS_KEY = "list";

/**
 * 項目の識別子(重複の判定・削除に使う)。アイコンとフォルダは、ホームの項目の識別子(`entryKey`)と同じ。
 * @param e 項目
 * @returns アイコンは `i:<パス>`、フォルダは `f:<ID>`、ミニアプリは `m:<フォルダ名>`
 */
export const shortcutKey = (e: ShortcutEntry) =>
  e.kind === "folder" ? `f:${e.id}` : e.kind === "mini" ? `m:${e.id}` : `i:${e.path}`;

/**
 * 参照先が無くなった項目を、一覧から外す。ショートカットウィジェットは、ホームにあるものの近道なので、ホームから無くなったものは、ここからも外す。
 * ミニアプリは別で、ホームではなく、ミニアプリのフォルダに無いときに外す。
 * @param list いまの一覧
 * @param homeKeys ホームにあるものの識別子(`f:<ID>` / `i:<パス>`)。まだ読み込めていないときは `null`(アイコン・フォルダは、そのまま残す)
 * @param miniIds ミニアプリのフォルダにあるミニアプリの名前(フォルダ名)。まだ読み込めていないときは `null`(ミニアプリは、そのまま残す)
 * @returns 残すものだけの一覧(外すものが無ければ、元の一覧そのもの)
 */
export function pruneShortcuts(
  list: ShortcutEntry[],
  homeKeys: ReadonlySet<string> | null,
  miniIds: ReadonlySet<string> | null,
): ShortcutEntry[] {
  const keep = list.filter((e) =>
    e.kind === "mini" ? !miniIds || miniIds.has(e.id) : !homeKeys || homeKeys.has(shortcutKey(e)),
  );
  return keep.length === list.length ? list : keep;
}

/**
 * 保存してあった文字列から、項目の一覧を読む。形が正しくないものは、捨てる。
 * @param raw 保存されていた JSON(無い・壊れているときは空の一覧)
 */
export function parseShortcuts(raw: string | undefined): ShortcutEntry[] {
  let v: unknown;
  try {
    v = JSON.parse(raw ?? "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(v)) return [];
  const out: ShortcutEntry[] = [];
  for (const x of v as Record<string, unknown>[]) {
    if (!x || typeof x.name !== "string") continue;
    if (x.kind === "mini") {
      if (typeof x.id === "string" && x.id) out.push({ kind: "mini", id: x.id, name: x.name });
      continue;
    }
    if (typeof x.path !== "string") continue;
    if (x.kind === "item") out.push({ kind: "item", path: x.path, name: x.name });
    else if (x.kind === "folder" && typeof x.id === "string")
      out.push({ kind: "folder", id: x.id, path: x.path, name: x.name });
  }
  return out.slice(0, MAX_SHORTCUTS);
}

/**
 * ドロップされたものを、項目にする。
 * @param d ドロップの内容
 */
export const entryFromDrop = (d: DropDetail): ShortcutEntry =>
  d.kind === "folder"
    ? { kind: "folder", id: d.id, path: d.path, name: d.name }
    : { kind: "item", path: d.path, name: d.name };

/**
 * ウィジェットの大きさから、アイコンの並べ方を決める。
 * 高さが 1 マス(小)・2 マス(標準)のときは 1 段、3 マス(大)のときは 2 段。1 段に置けるのは 6 個まで。
 * 小は、マスと同じ大きさ。標準・大は、横に 6 個並ぶ幅に合わせて大きくする(マスより小さくはしない。高さに収まる大きさまで)。
 * @param w ウィジェットの幅(px)
 * @param h ウィジェットの高さ(px)
 * @param cell マスの 1 辺(px)
 * @returns `rows` 段の数 / `side` アイコン 1 つの 1 辺(px) / `capacity` 置ける数
 */
export function iconLayout(w: number, h: number, cell: number): { rows: number; side: number; capacity: number } {
  const cellsTall = Math.max(1, Math.round((h + ICON_GAP) / (cell + ICON_GAP)));
  const rows = cellsTall >= 3 ? 2 : 1;
  const rowH = (h - ICON_GAP * (rows - 1)) / rows;
  const fit = (w - ICON_GAP * (MAX_PER_ROW - 1)) / MAX_PER_ROW;
  const side = cellsTall <= 1 ? cell : Math.floor(Math.min(rowH, Math.max(cell, fit)));
  return { rows, side, capacity: rows * MAX_PER_ROW };
}

/**
 * 画面の位置の下にある、アイコンの番号を求める(行・列から。一覧の外なら、いちばん近い端)。
 * アイコンが少ないときは、並びが真ん中に寄るので、その寄せたぶん(左の余白)を引いてから列を数える。
 * @param x 画面の x 座標
 * @param y 画面の y 座標
 * @param box アイコンを並べている入れ物(grid)の、画面での位置と幅(`left` / `top` / `width`)
 * @param side アイコン 1 つの 1 辺(px)
 * @param rows 段の数
 * @param count 並んでいるアイコンの数
 * @returns アイコンの番号(0 から。1 つもなければ 0)
 */
export function slotIndex(
  x: number,
  y: number,
  box: { left: number; top: number; width: number },
  side: number,
  rows: number,
  count: number,
): number {
  const step = side + ICON_GAP;
  const cols = Math.min(MAX_PER_ROW, Math.max(1, count));
  const offset = Math.max(0, (box.width - (cols * step - ICON_GAP)) / 2);
  const col = Math.min(cols - 1, Math.max(0, Math.floor((x - box.left - offset) / step)));
  const row = Math.min(rows - 1, Math.max(0, Math.floor((y - box.top) / step)));
  return Math.max(0, Math.min(count - 1, row * MAX_PER_ROW + col));
}

/**
 * 項目を、一覧の最後に足す。すでに入っているもの・置ける数を超えるものは、足さない。
 * @param list いまの一覧
 * @param entry 足す項目
 * @param capacity 置ける数(ウィジェットの高さで変わる。省くと、`MAX_SHORTCUTS`)
 * @returns `list` は新しい一覧。足せなかったときは `reason`(`exists` / `full`)
 */
export function addShortcut(
  list: ShortcutEntry[],
  entry: ShortcutEntry,
  capacity = MAX_SHORTCUTS,
): { list: ShortcutEntry[]; reason?: "exists" | "full" } {
  if (list.some((x) => shortcutKey(x) === shortcutKey(entry))) return { list, reason: "exists" };
  if (list.length >= capacity) return { list, reason: "full" };
  return { list: [...list, entry] };
}

/**
 * 項目の位置を変える(`from` の項目を取り出して、`to` の位置に入れる)。
 * @param list いまの一覧
 * @param from 動かす項目の番号
 * @param to 入れる位置の番号
 * @returns 新しい一覧。番号が範囲外・同じなら、元のまま
 */
export function moveShortcut(list: ShortcutEntry[], from: number, to: number): ShortcutEntry[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [m] = next.splice(from, 1);
  next.splice(to, 0, m);
  return next;
}

/**
 * 項目を、一覧から外す。
 * @param list いまの一覧
 * @param key 外す項目の識別子(`shortcutKey`)
 */
export const removeShortcut = (list: ShortcutEntry[], key: string) => list.filter((x) => shortcutKey(x) !== key);
