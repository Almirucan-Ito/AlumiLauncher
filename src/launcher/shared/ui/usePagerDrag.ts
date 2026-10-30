import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { useLatest } from "../lib/useLatest";
import { shiftDown } from "../drag/ShiftKeyController";
import {
  CENTER_SETTLE_MS,
  CENTER_ZONE,
  EDGE_FLIP_MS,
  EDGE_PX,
  LONG_PRESS_MS,
  MERGE_DWELL_MS,
  REORDER_DWELL_MS,
  RIM_ZONE,
  type HoverZone,
} from "./PagerModel";
import { type PagerProps } from "./PagerProps";

/** `usePagerDrag` に、`Pager` が渡すもの(`PagerProps` のドラッグに関わる項目と、`Pager` が持つ状態・関数)。 */
type Options<T> = Pick<
  PagerProps<T>,
  | "getId"
  | "onReorder"
  | "canDropOnto"
  | "mergeZone"
  | "quickDrop"
  | "onDropOnto"
  | "onMergeReady"
  | "onDragMove"
  | "onDragEnd"
  | "onDragOutside"
  | "onDragCancel"
> & {
  dragDelayMs?: number;
  mergeDelayMs?: number;
  items: T[];
  /** 常に最新の `items` */
  itemsRef: MutableRefObject<T[]>;
  rootRef: MutableRefObject<HTMLDivElement | null>;
  viewportRef: MutableRefObject<HTMLDivElement | null>;
  /** 表示中のページ・ページの数・ページを送る関数 */
  page: number;
  count: number;
  go: (d: number) => void;
  /** 画面の座標が、表示中のページの何番目のマスの上か(`cellAtPoint`) */
  cellAt: (x: number, y: number) => { index: number; fx: number; fy: number } | null;
  /** キーボードの選択を変える(マウスで操作し始めたら、外す) */
  setSelId: (id: string | null) => void;
};

/**
 * `Pager` のポインタ操作: スワイプ(横ドラッグ)でページを送る・ホイールでページを送る・アイコンの長押しドラッグ(並べ替え・重ねてフォルダ作成/移動・端でページ送り・ウィンドウの外へ出す)。
 * ドラッグの途中の状態(持ち上げているアイコン・重ねている相手・ゴースト・吸い込みのアニメーション)と、それを片付ける処理も持つ。
 * @param o `Options` を参照
 * @returns 描画に使う状態(`drag` `dragging` `dragId` `mergeId` `pending` `ghost` `fly`)と、`viewport` に付けるイベント(`onPointerDown` `onPointerMove` `onPointerUp` `onWheel`)・離した直後のクリックを無視するか(`suppressClick`)
 */
export function usePagerDrag<T>({
  getId,
  onReorder,
  canDropOnto,
  onDropOnto,
  quickDrop,
  onMergeReady,
  onDragMove,
  onDragEnd,
  onDragOutside,
  dragDelayMs = LONG_PRESS_MS,
  mergeDelayMs = MERGE_DWELL_MS,
  mergeZone,
  onDragCancel,
  itemsRef,
  rootRef,
  viewportRef,
  page,
  count,
  go,
  cellAt,
  setSelId,
}: Options<T>) {
  const goRef = useRef(go);
  goRef.current = go;

  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [ghost, setGhost] = useState({ x: 0, y: 0, plate: 90 });

  const start = useRef<number | null>(null);
  const moved = useRef(false);
  const wheelLock = useRef(0);
  const press = useRef<{ id: string; x: number; y: number; pointerId: number } | null>(null);
  const pressTimer = useRef<number>();
  const edgeTimer = useRef<number>();
  const edgeDir = useRef(0);
  const dragIdRef = useRef<string | null>(null);
  const suppressClick = useRef(false);

  /** 端に寄せているときのページ送りのタイマーを止める。 */
  const clearEdge = () => {
    clearTimeout(edgeTimer.current);
    edgeTimer.current = undefined;
    edgeDir.current = 0;
  };

  // ドラッグ中のアイコンが今どのアイコンの上にいるか(同じ場所に止まっている間だけ「重ねる/入れ替え」を判定する)
  const hover = useRef<{ id: string | null; zone: HoverZone; since: number; timer?: number; pendingTimer?: number }>({
    id: null,
    zone: "rim",
    since: 0,
  });
  const shiftRef = useRef(false); // ドラッグ中に Shift を押しているか(入れ替えとページ送りを止める)
  const mergeRef = useRef<string | null>(null);
  const [mergeId, setMergeId] = useState<string | null>(null);
  // 中央に重ねている(まだ待っている)間の表示。strong は「今離すだけで入る」相手
  const [pending, setPending] = useState<{ id: string; strong: boolean } | null>(null);
  // 離したアイコンが、相手の中へ吸い込まれるアニメーション
  const [fly, setFly] = useState<{ item: T; x: number; y: number; plate: number; go: boolean } | null>(null);

  /** 「どのアイコンの上にいるか」の判定と、それに付いた待ちのタイマー・表示を、すべて取り消す。 */
  const clearHover = () => {
    clearTimeout(hover.current.timer);
    clearTimeout(hover.current.pendingTimer);
    hover.current = { id: null, zone: "rim", since: 0 };
    if (mergeRef.current !== null) {
      mergeRef.current = null;
      setMergeId(null);
    }
    setPending((p) => (p === null ? p : null));
  };

  /** ドラッグを終える(タイマーと状態を片付ける)。直後の 80ms は、離したときのクリックを無視する。 */
  const endDrag = () => {
    clearTimeout(pressTimer.current);
    clearEdge();
    clearHover();
    press.current = null;
    if (dragIdRef.current) {
      dragIdRef.current = null;
      setDragId(null);
      suppressClick.current = true;
      setTimeout(() => (suppressClick.current = false), 80);
    }
  };

  // ウィンドウのフォーカスが外れたら(スクリーンショットなど)、ドラッグを取り消す。そのままだと、アイコンが持ち上がったまま残る
  const cancelOnBlurRef = useLatest(() => {
    if (!dragIdRef.current) return;
    endDrag();
    onDragCancel?.();
  });
  useEffect(() => {
    const onBlur = () => cancelOnBlurRef.current();
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [cancelOnBlurRef]);

  /** ポインタを押したとき。並べ替えができる一覧なら、長押しの時間(`dragDelayMs`)のあとで、ドラッグを始める(それまでに 8px 以上動いたら、スワイプとみなして長押しをやめる)。 */
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    setSelId(null); // マウスで操作し始めたら、キーボードの選択は外す
    start.current = e.clientX;
    moved.current = false;
    if (onReorder && getId) {
      const cellEl = (e.target as HTMLElement).closest<HTMLElement>("[data-id]");
      const id = cellEl?.dataset.id;
      if (id) {
        const info = { id, x: e.clientX, y: e.clientY, pointerId: e.pointerId };
        press.current = info;
        pressTimer.current = window.setTimeout(() => {
          dragIdRef.current = info.id;
          setDragId(info.id);
          // ゴーストは別の場所(.app 直下)に描くので、見た目の大きさをここで測って渡す
          const plate = cellEl?.querySelector<HTMLElement>(".plate")?.getBoundingClientRect().width;
          setGhost({ x: info.x, y: info.y, plate: plate || 90 });
          start.current = null;
          viewportRef.current?.setPointerCapture(info.pointerId);
        }, dragDelayMs);
      }
    }
  };

  /**
   * ドラッグ中のアイコンを、`targetId` のアイコンの位置へ入れ替える(Shift を押している間は、何もしない)。
   * @param targetId 入れ替える相手のアイコンの ID
   */
  const reorderTo = (targetId: string) => {
    if (shiftRef.current || shiftDown()) return; // Shift 中は、入れ替えない
    const cur = itemsRef.current;
    const id = dragIdRef.current;
    if (!id || !getId || !onReorder) return;
    const from = cur.findIndex((it) => getId(it) === id);
    const to = cur.findIndex((it) => getId(it) === targetId);
    if (from < 0 || to < 0 || from === to) return;
    const next = cur.slice();
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    onReorder(next);
  };

  /** ポインタが動いたとき。ドラッグ中なら、ウィンドウの外へ出たか・どのアイコンのどの位置か(中央 / 内側 / 縁)・端に寄ったか、を判定して、重ねる・入れ替え・ページ送りの待ちを仕掛ける。ドラッグ中でなければ、スワイプとして、ページを引っ張る(端では抵抗を付ける)。 */
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragIdRef.current) {
      // ウィンドウの外へ出したら、OS 標準のドラッグ(デスクトップ・エクスプローラーのフォルダへ移動)に切り替える
      if (
        onDragOutside &&
        (e.clientX < 0 || e.clientY < 0 || e.clientX > window.innerWidth || e.clientY > window.innerHeight)
      ) {
        const id = dragIdRef.current;
        if (onDragOutside(id)) {
          try {
            viewportRef.current?.releasePointerCapture(e.pointerId);
          } catch {
            /* すでに離れている */
          }
          endDrag();
          return;
        }
      }
      setGhost((g) => ({ ...g, x: e.clientX, y: e.clientY }));
      // Shift を押している間は、アイコンの自動移動(ほかのアイコンとの入れ替え・ページ送り)をしない。並びは固定される。
      // 重ねてフォルダへ入れる・アイコンどうしを重ねてフォルダを作る判定は、そのまま使える。
      // Shift を押した/離した瞬間は、判定をやり直す(押す前に始まった入れ替えの待ち時間を捨てる)
      const frozen = e.shiftKey || shiftDown();
      if (shiftRef.current !== frozen) {
        shiftRef.current = frozen;
        clearHover();
      }
      const dragKey = dragIdRef.current;
      onDragMove?.(dragKey, e.clientX, e.clientY);
      const hit = cellAt(e.clientX, e.clientY);
      const targetItem = hit ? itemsRef.current[hit.index] : undefined;
      const target = targetItem !== undefined ? (getId?.(targetItem) ?? undefined) : undefined;
      if (!hit || !target || target === dragKey) {
        clearHover();
      } else {
        // マスの中のどこにいるかで判定を分ける:
        //   中央(center) … 重ねる。落ち着いてから表示を出し、重ねて待つ時間が過ぎたら確定する
        //   内側(inner)  … 入れ替え。少し止まったときだけ(通り道で入れ替わってしまわないように)
        //   縁(rim)      … 何もしない(マスの境目をかすめただけで反応しないように)
        const zoneSize = mergeZone?.(dragKey, target) ?? CENTER_ZONE;
        const inCenter = Math.abs(hit.fx - 0.5) < zoneSize && Math.abs(hit.fy - 0.5) < zoneSize;
        const inInner = hit.fx > RIM_ZONE && hit.fx < 1 - RIM_ZONE && hit.fy > RIM_ZONE && hit.fy < 1 - RIM_ZONE;
        const mergeable = !!canDropOnto?.(dragKey, target);
        const zone: HoverZone = mergeable && inCenter ? "center" : inInner ? "inner" : "rim";
        if (hover.current.id !== target || hover.current.zone !== zone) {
          clearHover();
          hover.current = { id: target, zone, since: Date.now() };
          if (zone === "center") {
            hover.current.pendingTimer = window.setTimeout(
              () => setPending({ id: target, strong: !!quickDrop?.(dragKey, target) }),
              CENTER_SETTLE_MS,
            );
            hover.current.timer = window.setTimeout(
              () => {
                if (onMergeReady?.(dragKey, target)) {
                  setPending(null); // 呼び出し側が処理した(フォルダを開いた)
                  return;
                }
                mergeRef.current = target;
                setMergeId(target);
                setPending(null);
              },
              Math.max(mergeDelayMs, CENTER_SETTLE_MS),
            );
          } else if (zone === "inner" && !frozen) {
            hover.current.timer = window.setTimeout(() => !shiftRef.current && reorderTo(target), REORDER_DWELL_MS);
          }
        }
      }

      // 一覧の左右の端に近づけたらページを切り替える(一覧の外へ出しているときは切り替えない)
      const rect = viewportRef.current!.getBoundingClientRect();
      // フォルダ内では、枠(.sheet)の左右の余白(矢印のある所)まで含めて「端」とみなす。
      // 枠の外へ出しているとき(ホームへ移すとき)は切り替えない
      const sheetRect = rootRef.current?.closest<HTMLElement>(".sheet")?.getBoundingClientRect();
      const bandL = sheetRect ? sheetRect.left : rect.left - 20;
      const bandR = sheetRect ? sheetRect.right : rect.right + 20;
      const bandT = sheetRect ? sheetRect.top : rect.top;
      const bandB = sheetRect ? sheetRect.bottom : rect.bottom;
      const inBand = e.clientY >= bandT && e.clientY <= bandB && e.clientX >= bandL && e.clientX <= bandR;
      const dir =
        !inBand || frozen ? 0 : e.clientX < rect.left + EDGE_PX ? -1 : e.clientX > rect.right - EDGE_PX ? 1 : 0;
      if (dir === 0) clearEdge();
      else if (edgeDir.current !== dir || edgeTimer.current === undefined) {
        // 端に寄せている間は、ポインタを動かさなくても、一定の間隔で次のページへ送り続ける
        clearEdge();
        edgeDir.current = dir;
        const arm = (ms: number) => {
          edgeTimer.current = window.setTimeout(() => {
            goRef.current(dir);
            arm(EDGE_FLIP_MS + 150);
          }, ms);
        };
        arm(EDGE_FLIP_MS);
      }
      return;
    }

    if (press.current && Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > 8) {
      clearTimeout(pressTimer.current); // スワイプと判断 → 長押しは取り消し
      press.current = null;
    }
    if (start.current === null) return;
    let dx = e.clientX - start.current;
    if (!moved.current && Math.abs(dx) > 8) {
      moved.current = true;
      setDragging(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    if (!moved.current) return;
    // 端ではゴム紐のように抵抗を付ける
    if ((page === 0 && dx > 0) || (page === count - 1 && dx < 0)) dx *= 0.3;
    setDrag(dx);
  };

  /** ポインタを離したとき。ドラッグ中なら、呼び出し側の処理(`onDragEnd`)→ 重ねて離した処理(`onDropOnto`。相手の中へ吸い込まれるアニメーション付き)の順に、確定する。スワイプなら、60px 以上動いていればページを送る。 */
  const onPointerUp = (e: React.PointerEvent) => {
    const dragged = dragIdRef.current;
    const mergeTarget = mergeRef.current;
    // 重ねて待つ時間が過ぎる前でも、アイコンの中央に重ねて離したなら「重ねた」とみなす(ready=false)
    const quickTarget =
      mergeTarget || hover.current.zone !== "center" || Date.now() - hover.current.since < CENTER_SETTLE_MS
        ? null
        : hover.current.id;
    const draggedItem = dragged !== null && getId ? itemsRef.current.find((it) => getId(it) === dragged) : undefined;
    const ghostAt = ghost;
    endDrag();
    if (dragged !== null) {
      start.current = null;
      if (onDragEnd?.(dragged, e.clientX, e.clientY)) return;
      const dropTarget = mergeTarget ?? quickTarget;
      if (onDropOnto && dropTarget && (mergeTarget || quickDrop?.(dragged, dropTarget) !== false)) {
        // 重ねたアイコンが相手の中へ吸い込まれる動き(離した瞬間が分かるように)
        const to = viewportRef.current
          ?.querySelector<HTMLElement>(`[data-id="${CSS.escape(dropTarget)}"] .plate`)
          ?.getBoundingClientRect();
        if (draggedItem !== undefined && to) {
          setFly({ item: draggedItem, x: ghostAt.x, y: ghostAt.y, plate: ghostAt.plate, go: false });
          requestAnimationFrame(() =>
            requestAnimationFrame(() =>
              setFly((f) => (f ? { ...f, x: to.left + to.width / 2, y: to.top + to.height / 2, go: true } : f)),
            ),
          );
          window.setTimeout(() => setFly(null), 380);
        }
        onDropOnto(dragged, dropTarget, !!mergeTarget);
      }
      return;
    }
    if (start.current === null) return;
    const dx = e.clientX - start.current;
    start.current = null;
    if (moved.current) {
      if (dx < -60) go(1);
      else if (dx > 60) go(-1);
    }
    setDrag(0);
    setDragging(false);
  };

  /** マウスホイール(や横スクロール)でページを送る。350ms の間は続けて送らない(勢いのある回転で、何ページも飛ばないように)。 */
  const onWheel = (e: React.WheelEvent) => {
    const now = Date.now();
    if (now - wheelLock.current < 350) return;
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(d) < 10) return;
    wheelLock.current = now;
    go(d > 0 ? 1 : -1);
  };

  return {
    drag,
    dragging,
    dragId,
    mergeId,
    pending,
    ghost,
    fly,
    suppressClick,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel,
  };
}
