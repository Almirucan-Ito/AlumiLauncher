import { cachedItems, fetchItems } from "../icons/IconController";
import { type Item } from "../../shared/api/ApiModel";
import { useEffect, useState } from "react";

/**
 * フォルダの中のアイコンの一覧を使う(部品用のフック)。覚えている一覧があればすぐ返し、そのあと取得し直す。パスが分からない間は空の一覧。
 * @param path フォルダのパス
 * @param reload この値が変わったら、取得し直す
 * @returns 一覧(読み込み中は `undefined`)
 */
export function useFolderItems(path: string, reload: number) {
  const [items, setItems] = useState<Item[] | undefined>(() => (path ? cachedItems(path) : []));
  useEffect(() => {
    if (!path) return setItems([]); // まだパスが分からない間は空
    let live = true;
    fetchItems(path)
      .then((r) => live && setItems(r))
      .catch(() => live && setItems([]));
    return () => {
      live = false;
    };
  }, [path, reload]);
  return items;
}
