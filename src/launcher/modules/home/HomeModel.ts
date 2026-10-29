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
