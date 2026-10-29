import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Arrow } from "./PagerArrow";
import { LONG_PRESS_MS, MERGE_DWELL_MS, cellAtPoint, chunk, computeGrid, type Grid } from "./PagerModel";
import { type PagerProps } from "./PagerProps";
import { usePagerDrag } from "./usePagerDrag";
import { usePagerFlip } from "./usePagerFlip";
import { usePagerKeyboard } from "./usePagerKeyboard";

// 一覧の型と計算は、PagerModel.ts にある。これまでどおり、ここから読み込める
export { computeGrid, makeEdgeFlipper } from "./PagerModel";
export type { PagerApi, PagerLayout } from "./PagerModel";

/**
 * アイコンを、ページごとのグリッドに並べる一覧。
 * ・スワイプ(横ドラッグ)・マウスホイール・矢印キー・端の矢印・ドットでページを送る。表示中のページと、その前後だけを描画する(アイコンが多くても、DOM・画像・メモリを増やさない)。
 * ・アイコンの長押しでドラッグを始め、並べ替え(少し止まったとき)・重ねてフォルダ作成/フォルダへ移動(中央に重ねたまま待つ)・端に寄せてページ送り・ウィンドウの外へ出して OS のドラッグに切り替え、ができる(Shift を押している間は、入れ替えとページ送りを止める)。
 * ・アイコンが別の位置へ動くときは、元の位置から滑らかに動かす(FLIP アニメーション)。
 * @typeParam T 並べるものの型
 * @param props `items`(並べるもの)・`render`(1 つの描き方)・`layout`(並べ方)と、ドラッグ操作のコールバック(`Props` を参照)
 */
export function Pager<T>({
  items,
  render,
  layout,
  keyboard = true,
  className = "",
  getId,
  onReorder,
  canDropOnto,
  onDropOnto,
  slotRef,
  quickDrop,
  apiRef,
  onMergeReady,
  onDragMove,
  onDragEnd,
  onDragOutside,
  dragDelayMs = LONG_PRESS_MS,
  mergeDelayMs = MERGE_DWELL_MS,
  mergeZone,
  onDragCancel,
}: PagerProps<T>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [grid, setGrid] = useState<Grid>(() => computeGrid(layout, 0, 0));

  // 並べ方(layout)は、呼ぶ側が毎回作り直すので、項目ごとに取り出して、依存にする(中身が変わったときだけ、測り直す)
  const { mode: layoutMode, count: layoutCount, size: layoutSize, gap: layoutGap, compact: layoutCompact } = layout;
  // サイズ変更中に毎フレーム再描画しないよう、列数・行数が変わったときだけ state を更新する
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let raf = 0;
    const measure = () => {
      const next = computeGrid(
        { mode: layoutMode, count: layoutCount, size: layoutSize, gap: layoutGap, compact: layoutCompact },
        el.clientWidth,
        el.clientHeight,
      );
      setGrid((prev) =>
        prev.cols === next.cols && prev.rows === next.rows && prev.perPage === next.perPage ? prev : next,
      );
    };
    measure();
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [layoutMode, layoutCount, layoutSize, layoutGap, layoutCompact]);

  const { cols, rows, perPage } = grid;

  const pages = useMemo(() => chunk(items, perPage), [items, perPage]);
  const count = pages.length;
  const [page, setPage] = useState(0);
  const pageRef = useRef(0);
  pageRef.current = page;

  const viewportRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  usePagerFlip(viewportRef, pages, page, cols, rows);

  /**
   * 画面の座標が、表示中のページの何番目のマスの上かを求める。マスの並び(グリッド)から計算する(動いている最中のアイコンの位置を使うと、アニメーション中に値がぶれて、入れ替えが行ったり来たりするため)。
   * フォルダ内の画面など、この一覧より手前にほかのものが重なっているときは `null`。
   * @param x 画面の x 座標
   * @param y 画面の y 座標
   * @returns `index`(全体の通し番号)と、マスの中の位置 `fx` / `fy`(0〜1)。マスの外なら `null`
   */
  const cellAt = (x: number, y: number) => cellAtPoint(viewportRef.current, rootRef.current, page, perPage, x, y);
  if (slotRef) {
    slotRef.current = (x, y) => cellAt(x, y)?.index ?? null;
  }

  /**
   * ページを送る(範囲の外へは出ない)。
   * @param d 送る数(+1 で次、-1 で前)
   */
  const go = useCallback((d: number) => setPage((p) => Math.min(count - 1, Math.max(0, p + d))), [count]);
  if (apiRef) apiRef.current = { go, rect: () => viewportRef.current?.getBoundingClientRect() ?? null };

  useEffect(() => setPage((p) => Math.min(p, count - 1)), [count]);

  // ---- キーボード操作: 矢印キーで選択を動かし(ページをまたぐと自動でページが切り替わる)、Enter / Space で開く ----
  const [selId, setSelId] = useState<string | null>(null);
  const selRef = useRef<string | null>(null);
  selRef.current = selId;
  const gridRef = useRef(grid);
  gridRef.current = grid;
  usePagerKeyboard({ keyboard, getId, itemsRef, gridRef, selRef, pageRef, viewportRef, setSelId, setPage });

  const d = usePagerDrag({
    getId,
    onReorder,
    canDropOnto,
    onDropOnto,
    quickDrop,
    onMergeReady,
    onDragMove,
    onDragEnd,
    onDragOutside,
    dragDelayMs,
    mergeDelayMs,
    mergeZone,
    onDragCancel,
    items,
    itemsRef,
    rootRef,
    viewportRef,
    page,
    count,
    go,
    cellAt,
    setSelId,
  });
  const { drag, dragging, dragId, mergeId, pending, ghost, fly } = d;

  const dragItem = dragId && getId ? items.find((it) => getId(it) === dragId) : undefined;
  const appEl = typeof document !== "undefined" ? document.querySelector<HTMLElement>(".app") : null;

  return (
    <div
      ref={rootRef}
      className={`pager ${className}`}
      style={{ ["--cols" as string]: cols, ["--rows" as string]: rows } as CSSProperties}
    >
      <div
        ref={viewportRef}
        className="viewport"
        onPointerDown={d.onPointerDown}
        onPointerMove={d.onPointerMove}
        onPointerUp={d.onPointerUp}
        onPointerCancel={d.onPointerUp}
        onClickCapture={(e) => {
          if (d.suppressClick.current) {
            e.stopPropagation();
            e.preventDefault();
          }
        }}
        onWheel={d.onWheel}
      >
        <div
          className={`track${dragging ? " dragging" : ""}`}
          style={{ transform: `translate3d(calc(${-page * 100}% + ${drag}px),0,0)` }}
        >
          {pages.map((pg, i) => (
            <div className="page" key={i} aria-hidden={i !== page}>
              {/* 表示中のページと、その前後だけを描画する(アイコン数が多くても、DOM・画像・メモリを増やさない) */}
              {(Math.abs(i - page) <= 1 ? pg : []).map((it, n) => {
                const id = getId?.(it) ?? null;
                return (
                  <div
                    className={`cell${id !== null && id === selId ? " selected" : ""}${id !== null && id === dragId ? " lifted" : ""}${id !== null && id === mergeId ? " merge" : ""}${
                      id !== null && pending?.id === id ? (pending.strong ? " merge" : " pending") : ""
                    }`}
                    key={id ?? `i${i}-${n}`}
                    data-id={id ?? undefined}
                  >
                    {render(it)}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ドラッグ中のアイコン(ゴースト)は .app 直下に描く: フォルダ内の画面が消えても(ホームへ出すとき)見え続けるように */}
      {dragItem &&
        appEl &&
        createPortal(
          <div
            className="drag-ghost"
            style={{ left: ghost.x, top: ghost.y, ["--plate" as string]: `${ghost.plate}px` } as CSSProperties}
          >
            {render(dragItem)}
          </div>,
          appEl,
        )}
      {fly &&
        appEl &&
        createPortal(
          <div
            className={`drag-ghost flying${fly.go ? " go" : ""}`}
            style={{ left: fly.x, top: fly.y, ["--plate" as string]: `${fly.plate}px` } as CSSProperties}
          >
            {render(fly.item)}
          </div>,
          appEl,
        )}

      {page > 0 && (
        <button className="edge edge-left" aria-label="前のページ" onClick={() => go(-1)}>
          <Arrow dir="left" />
        </button>
      )}
      {page < count - 1 && (
        <button className="edge edge-right" aria-label="次のページ" onClick={() => go(1)}>
          <Arrow dir="right" />
        </button>
      )}

      {count > 1 && (
        <div className="dots">
          {pages.map((_, i) => (
            <button
              key={i}
              className={i === page ? "dot on" : "dot"}
              aria-label={`${i + 1}ページ目`}
              onClick={() => setPage(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
