import { useLayoutEffect, useRef, type RefObject } from "react";
import { FLIP_MS } from "./PagerModel";

/**
 * 一覧のアイコンが別の位置へ動くとき、元の位置からスッと滑らかに移動させる(FLIP アニメーション)。
 * @param viewportRef 一覧の表示領域の要素
 * @param pages ページごとの項目(並びが変わったことを知るため)
 * @param page 表示中のページ
 * @param cols 列数
 * @param rows 行数
 */
export function usePagerFlip(
  viewportRef: RefObject<HTMLElement>,
  pages: unknown,
  page: number,
  cols: number,
  rows: number,
) {
  // アイコンが別の位置へ動くとき、元の位置からスッと滑らかに移動させる(FLIP アニメーション)。
  // ・位置は、動きの影響を受けない「レイアウト上の位置」(offsetLeft/Top)で比べる
  // ・まだ動いている最中に並びが変わったら、今見えている位置から動き直す(ぶれたり跳ねたりしない)
  const cellPos = useRef(new Map<string, { page: number; x: number; y: number }>());
  useLayoutEffect(() => {
    const root = viewportRef.current;
    if (!root) return;
    const next = new Map<string, { page: number; x: number; y: number }>();
    root.querySelectorAll<HTMLElement>(".page").forEach((pageEl, pi) => {
      pageEl.querySelectorAll<HTMLElement>(".cell[data-id]").forEach((el) => {
        const id = el.dataset.id!;
        const x = el.offsetLeft - pageEl.offsetLeft;
        const y = el.offsetTop - pageEl.offsetTop;
        next.set(id, { page: pi, x, y });
        const prev = cellPos.current.get(id);
        if (prev && prev.page === pi && (Math.abs(prev.x - x) > 1 || Math.abs(prev.y - y) > 1)) {
          // 今(動いている最中の)ずれ
          const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
          el.style.transition = "none";
          el.style.transform = `translate(${prev.x - x + m.m41}px, ${prev.y - y + m.m42}px)`;
          void el.offsetWidth; // 動かす前の位置を確定させてから、元の位置(=0)へ向けてアニメーションする
          el.style.transition = `transform ${FLIP_MS}ms var(--ease-move), opacity 0.15s`;
          el.style.transform = "";
        }
      });
    });
    cellPos.current = next;
  }, [viewportRef, pages, page, cols, rows]);
}
