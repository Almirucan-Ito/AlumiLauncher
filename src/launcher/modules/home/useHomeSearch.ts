import { useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { type FolderEntry, api } from "../../shared/api/ApiModel";
import { type OpenFolder } from "../folders/FolderModel";
import { cachedItems } from "../icons/IconController";
import { type HomeEntry } from "./HomeModel";

/**
 * 検索ウィジェットの入力で、ホームのアイコンを名前で絞り込む。
 * フォルダは、フォルダ名か、中のアイコン名(覚えている一覧)が当たったときに残す。
 *
 * @param entriesRef いまのホームの並び(最新のものを読むための参照)
 * @param setOpen 開いているフォルダを変える関数(フォルダ名に当たって Enter を押したとき、そのフォルダを開く)
 * @returns
 * - `query`・`setQuery`: 入力の文字
 * - `q`: 前後の空白を除いて小文字にした、探す文字(空なら、絞り込まない)
 * - `entryMatches`: ホームの項目が、検索に当たるか
 * - `onSearchEnter`: Enter が押されたとき。最初に見つかったアイコンを起動する(フォルダ名に当たったときは、そのフォルダを開く)
 */
export function useHomeSearch(
  entriesRef: MutableRefObject<HomeEntry[]>,
  setOpen: Dispatch<SetStateAction<OpenFolder | null>>,
) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  /** 名前が、検索の文字を含むか(大文字・小文字は区別しない)。 */
  const nameHas = (name: string) => name.toLowerCase().includes(q);
  /** フォルダの中で、検索に当たる最初のアイコン(覚えている一覧から探す)。 */
  const innerHit = (f: FolderEntry) => (cachedItems(f.path) ?? []).find((i) => nameHas(i.name));
  /** ホームの項目が、検索に当たるか(フォルダは、フォルダ名か、中のアイコン名が当たったとき)。 */
  const entryMatches = (e: HomeEntry) =>
    e.kind === "folder"
      ? nameHas(e.folder.name) || !!innerHit(e.folder)
      : e.kind === "item"
        ? nameHas(e.item.name)
        : false;
  /** 検索で Enter: 最初に見つかったアイコンを起動する。フォルダ名に当たったときは、そのフォルダを開く。 */
  const onSearchEnter = () => {
    if (!q) return;
    for (const e of entriesRef.current) {
      if (!entryMatches(e)) continue;
      if (e.kind === "item") return void api.launch(e.item.path);
      if (e.kind === "folder") {
        if (!nameHas(e.folder.name)) {
          const hit = innerHit(e.folder);
          if (hit) return void api.launch(hit.path);
        }
        return setOpen({ folder: e.folder, origin: { x: window.innerWidth / 2, y: window.innerHeight / 2 } });
      }
    }
  };
  return { query, setQuery, q, entryMatches, onSearchEnter };
}
