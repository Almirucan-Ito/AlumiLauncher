import { useRef, type MutableRefObject } from "react";
import { type Config } from "../../shared/api/ApiModel";
import { type HomeEntry, entryKey } from "../home/HomeModel";
import { DROP_EVENT, type DropDetail } from "../plugins/PluginModel";

/**
 * ホームのアイコン・フォルダを、ウィジェットの上へドラッグして落とす操作。
 * ドロップを受けたいウィジェットは、要素に `data-drop-target` を付ける。ここでは、指の下にそういう要素があれば、枠で示し(`data-drop-hover`)、
 * 離したら、その要素へ `alumi:drop` のイベント(中身は `DropDetail`)を送る。どのウィジェットかは知らないので、ウィジェット側が自由に使える。
 * 落としたものは、ホームから無くならない(ウィジェットは、参照を持つだけ)。
 * @param configRef 常に最新の設定(フォルダの一覧を読む)
 * @param entriesRef いまのホームの並び(アイコンを探す)
 * @returns ホームの `Pager` の `onDragMove` / `onDragEnd` から呼ぶ関数と、枠を消す関数
 */
export function useWidgetDrop({
  configRef,
  entriesRef,
}: {
  configRef: MutableRefObject<Config | null>;
  entriesRef: MutableRefObject<HomeEntry[]>;
}) {
  const hover = useRef<HTMLElement | null>(null);

  /** 指の下の、ドロップを受けられる要素(無ければ `null`)。 */
  const targetAt = (x: number, y: number) =>
    document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-drop-target]") ?? null;

  /**
   * 枠を付ける要素を切り替える。
   * @param el 枠を付ける要素。`null` なら、枠を消す
   */
  const setHover = (el: HTMLElement | null) => {
    if (hover.current === el) return;
    hover.current?.removeAttribute("data-drop-hover");
    el?.setAttribute("data-drop-hover", "true");
    hover.current = el;
  };

  /**
   * ホームのドラッグの識別子から、落とす内容を作る。
   * @param key `entryKey` の形(`f:<ID>` / `i:<パス>`)
   * @returns 内容。見つからなければ `null`
   */
  const detailOf = (key: string): DropDetail | null => {
    const e = entriesRef.current.find((x) => x.kind !== "slot" && entryKey(x) === key);
    if (!e || e.kind === "slot") return null;
    if (e.kind === "item") return { kind: "item", name: e.item.name, path: e.item.path };
    const folder = configRef.current?.folders.find((f) => f.id === e.folder.id) ?? e.folder;
    return { kind: "folder", id: folder.id, name: folder.name, path: folder.path };
  };

  /**
   * ドラッグ中に指が動いたとき。落とせる要素の上なら、枠で示す。
   * @param _key ドラッグしているもの
   * @param x 画面の x 座標
   * @param y 画面の y 座標
   */
  const onMove = (_key: string, x: number, y: number) => setHover(targetAt(x, y));

  /**
   * ドラッグを離したとき。落とせる要素の上なら、その要素へ知らせる。
   * @param key ドラッグしていたもの
   * @param x 画面の x 座標
   * @param y 画面の y 座標
   * @returns 受け取る要素があって知らせたら `true`(ホームの並びは、動かさない)
   */
  const onEnd = (key: string, x: number, y: number): boolean => {
    const el = targetAt(x, y);
    setHover(null);
    const detail = el ? detailOf(key) : null;
    if (!el || !detail) return false;
    el.dispatchEvent(new CustomEvent(DROP_EVENT, { detail }));
    return true;
  };

  return { onMove, onEnd, clear: () => setHover(null) };
}
