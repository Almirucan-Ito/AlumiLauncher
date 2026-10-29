import { LEAVE_DWELL_MS, type Origin, SLOT_ITEM, applyOrder } from "./FolderModel";
import { useFolderItems } from "./useFolderItems";
import { type FolderEntry, type Item } from "../../shared/api/ApiModel";
import { shiftDown } from "../../shared/drag/ShiftKeyController";
import { t } from "../../shared/i18n/i18n";
import { AppTile } from "../../shared/ui/AppTile";
import { Pager, type PagerApi, type PagerLayout, makeEdgeFlipper } from "../../shared/ui/Pager";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * フォルダを開いた画面。フォルダ内のアイコンを並べ、ドラッグで並べ替え・ホームや別のフォルダへ持ち出し・ウィンドウの外へ移動ができる。ホームのアイコンをこのフォルダへ入れるとき(`dragIn`)は、ポインタの下のマスに空きを作る。
 * Esc か外側のクリックで閉じる。
 * @param props `folder` 対象 / `order` 並び順 / `origin` 開く起点 / `layout` 並べ方 / `reload` 取り直し / `onOrder` 並びが変わったとき / `onClose` 閉じる / `onItemMenu`・`onFolderMenu` 右クリック / `dragDelayMs` 長押しの時間 / `dragIn`・`subscribePointer`・`dropInfo` ホームからの持ち込み / `leaving`・`onLeaving`・`onItemDragMove`・`onItemDragEnd` ホームへの持ち出し / `onDragOutside` ウィンドウの外へ / `onDragCancel` ドラッグの取り消し
 */
export function FolderView({
  folder,
  order,
  origin,
  layout,
  reload,
  onOrder,
  onClose,
  onItemMenu,
  onFolderMenu,
  dragDelayMs,
  dragIn,
  subscribePointer,
  dropInfo,
  leaving,
  onLeaving,
  onItemDragMove,
  onItemDragEnd,
  onDragOutside,
  onDragCancel,
}: {
  folder: FolderEntry;
  order: string[] | undefined;
  origin: Origin;
  layout: PagerLayout;
  reload: number;
  onOrder: (folderId: string, paths: string[]) => void;
  onClose: () => void;
  onItemMenu: (item: Item, x: number, y: number) => void;
  onFolderMenu: (folder: FolderEntry, x: number, y: number) => void;
  dragDelayMs: number;
  /** ホームのアイコンをこのフォルダへドラッグしてきている間、そのアイコン(置く位置に空きを作る) */
  dragIn: Item | null;
  /** ホーム側のドラッグの座標を受け取る(dragIn の間だけ使う) */
  subscribePointer: (fn: (x: number, y: number) => void) => () => void;
  /** 置く位置(何番目か)と、今のアイコンの並び。離したときにホーム側が読む */
  dropInfo: React.MutableRefObject<{ index: number | null; paths: string[] }>;
  /** フォルダ内のアイコンを枠の外へ持ち出している間、true(この画面を薄くして、後ろのホームを見せる) */
  leaving: boolean;
  onLeaving: (leaving: boolean) => void;
  onItemDragMove: (x: number, y: number) => void;
  /** 枠の外で離したとき。ホームへ移動したなら true */
  onItemDragEnd: (item: Item, x: number, y: number) => boolean;
  /** アイコンをウィンドウの外へドラッグした(パスを渡す)。true なら、OS 標準のドラッグに切り替えた */
  onDragOutside: (path: string) => boolean;
  onDragCancel: () => void;
}) {
  const raw = useFolderItems(folder.path, reload);
  const items = useMemo(() => (raw ? applyOrder(raw, order) : undefined), [raw, order]);
  const [closing, setClosing] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  dropInfo.current.paths = items?.map((i) => i.path) ?? [];

  /**
   * 画面の座標が、フォルダの枠(`.sheet`)の外か。
   * @param x 画面の x 座標
   * @param y 画面の y 座標
   */
  const isOutside = useCallback((x: number, y: number) => {
    const r = sheetRef.current?.getBoundingClientRect();
    return !!r && (x < r.left || x > r.right || y < r.top || y > r.bottom);
  }, []);

  // ---- ホームのアイコンをこのフォルダへ入れるとき: ポインタが乗っているマスに空きを作る ----
  const pagerSlot = useRef<((x: number, y: number) => number | null) | null>(null);
  const pagerApi = useRef<PagerApi | null>(null);
  const flipper = useMemo(() => makeEdgeFlipper(() => pagerApi.current), []);
  const [slot, setSlot] = useState<number | null>(null);
  useEffect(() => {
    if (!dragIn) {
      setSlot(null);
      dropInfo.current.index = null;
      flipper.stop();
      return;
    }
    const off = subscribePointer((x, y) => {
      // ▷ ◁ の位置にアイコンを持っていくと、ページが送られる(ホームのアイコンをフォルダへ入れる途中でも使える)
      // Shift 中は、ページ送りも、置く位置の空き(ほかのアイコンのよけ)も動かさない
      if (shiftDown()) {
        flipper.stop();
        return;
      }
      flipper.feed(x, y, true);
      // 置く位置は、ポインタが乗っているマスの番号。マスの並びから計算するので、
      // 空きができてアイコンがよけている最中でも、同じマスの上なら同じ位置のまま(行ったり来たりしない)
      let idx: number | null = null;
      if (!isOutside(x, y)) {
        const len = itemsRef.current?.length ?? 0;
        const g = pagerSlot.current?.(x, y);
        idx = g === null || g === undefined ? len : Math.min(g, len);
      }
      dropInfo.current.index = idx;
      setSlot((p) => (p === idx ? p : idx));
    });
    return () => {
      flipper.stop();
      off();
    };
  }, [dragIn, subscribePointer, isOutside, dropInfo, flipper]);

  const listForPager = useMemo(() => {
    if (!items) return items;
    if (slot === null || !dragIn) return items;
    return [...items.slice(0, slot), SLOT_ITEM, ...items.slice(slot)];
  }, [items, slot, dragIn]);

  // ---- フォルダ内のアイコンを枠の外へ持ち出すとき: しばらく外にいたら、この画面を薄くしてホームを見せる ----
  const outsideTimer = useRef<number>();
  // いったん薄くなったら、そのドラッグが終わるまでホームへ出た扱いにする(スマートフォンのホーム画面と同じ。
  // 薄くなった後は、フォルダ内の画面があった場所の上でも、ホームの位置として扱う)
  /**
   * フォルダ内のアイコンをドラッグして動かしている間。枠の外に `LEAVE_DWELL_MS` とどまったら、フォルダ内の画面を薄くして、ホームを見せる。いったん薄くなったら、そのドラッグが終わるまで、ホームへ出た扱いにする(スマートフォンのホーム画面と同じ)。
   * @param _id ドラッグ中のアイコン(使わない)
   * @param x 画面の x 座標
   * @param y 画面の y 座標
   */
  const onDragMove = (_id: string, x: number, y: number) => {
    if (!leaving) {
      if (isOutside(x, y)) {
        if (outsideTimer.current === undefined) {
          outsideTimer.current = window.setTimeout(() => onLeaving(true), LEAVE_DWELL_MS);
        }
      } else {
        clearTimeout(outsideTimer.current);
        outsideTimer.current = undefined;
      }
    }
    onItemDragMove(x, y);
  };
  /**
   * フォルダ内のアイコンのドラッグを離したとき。枠の外(または、薄くなったあと)で離したときだけ、ホーム側の処理へ渡す。
   * @param id ドラッグしていたアイコンのパス
   * @param x 離した画面の x 座標
   * @param y 離した画面の y 座標
   * @returns ホーム側が処理したなら `true`(フォルダ内の並べ替えは、しない)
   */
  const onDragEnd = (id: string, x: number, y: number) => {
    clearTimeout(outsideTimer.current);
    outsideTimer.current = undefined;
    const item = items?.find((i) => i.path === id);
    if (!item || !(leaving || isOutside(x, y))) return false; // フォルダの中で離した: 並べ替えだけ
    return onItemDragEnd(item, x, y);
  };

  /** フォルダを閉じる(閉じるアニメーション 180ms のあとで、`onClose` を呼ぶ)。 */
  const close = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 180);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  return (
    <div
      className={`overlay${closing ? " closing" : ""}${leaving ? " leaving" : ""}`}
      style={{ transformOrigin: `${origin.x}px ${origin.y}px` }}
      onClick={close}
      onContextMenu={(e) => {
        e.preventDefault();
        onFolderMenu(folder, e.clientX, e.clientY);
      }}
    >
      <div
        className="sheet"
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={folder.name}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{folder.name}</h2>
        {listForPager === undefined ? (
          <div className="empty">{t("loading")}</div>
        ) : listForPager.length === 0 ? (
          <div className="empty">{t("emptyFolder")}</div>
        ) : (
          <Pager
            items={listForPager}
            layout={layout}
            getId={(it) => (it.path === SLOT_ITEM.path ? null : it.path)}
            onReorder={(next) =>
              onOrder(
                folder.id,
                next.map((i) => i.path),
              )
            }
            dragDelayMs={dragDelayMs}
            slotRef={pagerSlot}
            apiRef={pagerApi}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
            onDragCancel={() => {
              clearTimeout(outsideTimer.current);
              outsideTimer.current = undefined;
              onDragCancel();
            }}
            onDragOutside={(id) => {
              // ウィンドウの外へ出す(OS のドラッグに切り替わる)前に、「枠の外で待つ」タイマーを片付ける
              clearTimeout(outsideTimer.current);
              outsideTimer.current = undefined;
              return onDragOutside(id);
            }}
            // フォルダ内のアイコンも、周りの枠(膜)は付けない。置く位置の空きは、何も描かない
            render={(it) =>
              it.path === SLOT_ITEM.path ? (
                <div key="slot" className="slot-hole" />
              ) : (
                <AppTile key={it.path} item={it} onMenu={onItemMenu} bare />
              )
            }
          />
        )}
      </div>
    </div>
  );
}
