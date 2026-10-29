import { useEffect, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from "react";

/**
 * キーボード操作: 矢印キーで選択を動かし(ページをまたぐと自動でページが切り替わる)、Enter / Space で開く。
 * ダイアログ・設定・メニューを開いている間と、文字の入力中は、触らない。
 * @param keyboard 有効にするか
 * @param getId 項目の ID を返す関数(無ければ、選べない)
 * @param itemsRef いまの項目の一覧
 * @param gridRef いまのグリッド(列数・1 ページの数)
 * @param selRef いま選んでいる項目の ID
 * @param pageRef いま表示しているページ
 * @param viewportRef 一覧の表示領域の要素
 * @param setSelId 選ぶ項目を変える関数
 * @param setPage ページを変える関数
 */
export function usePagerKeyboard<T>({
  keyboard,
  getId,
  itemsRef,
  gridRef,
  selRef,
  pageRef,
  viewportRef,
  setSelId,
  setPage,
}: {
  keyboard: boolean;
  getId: ((item: T) => string | null) | undefined;
  itemsRef: MutableRefObject<T[]>;
  gridRef: MutableRefObject<{ cols: number; perPage: number }>;
  selRef: MutableRefObject<string | null>;
  pageRef: MutableRefObject<number>;
  viewportRef: RefObject<HTMLElement>;
  setSelId: Dispatch<SetStateAction<string | null>>;
  setPage: Dispatch<SetStateAction<number>>;
}) {
  useEffect(() => {
    if (!keyboard || !getId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (document.querySelector(".modal, .settings, .menu")) return; // ダイアログ・設定・メニューを開いている間は触らない
      const ids = itemsRef.current.map((it) => getId(it)).filter((x): x is string => x !== null);
      if (ids.length === 0) return;
      const { cols, perPage: per } = gridRef.current;
      const cur = selRef.current === null ? -1 : ids.indexOf(selRef.current);
      if (e.key === "Enter" || e.key === " ") {
        if (cur < 0) return;
        e.preventDefault();
        viewportRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(ids[cur])}"] .tile`)?.click();
        return;
      }
      const delta =
        e.key === "ArrowLeft"
          ? -1
          : e.key === "ArrowRight"
            ? 1
            : e.key === "ArrowUp"
              ? -cols
              : e.key === "ArrowDown"
                ? cols
                : 0;
      if (!delta) return;
      e.preventDefault();
      let next: number;
      if (cur < 0)
        next = Math.min(ids.length - 1, pageRef.current * per); // まだ何も選んでいなければ、表示中のページの先頭
      else {
        next = cur + delta;
        if (next < 0 || next >= ids.length) next = cur; // 端では動かさない
      }
      setSelId(ids[next]);
      setPage(Math.floor(next / per));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keyboard, getId, itemsRef, gridRef, selRef, pageRef, viewportRef, setSelId, setPage]);
}
