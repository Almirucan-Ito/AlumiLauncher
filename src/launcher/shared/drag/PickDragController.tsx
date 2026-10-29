import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * 一覧(ウィジェット・ミニアプリ)の行を掴んで、画面の好きな場所へドラッグして落とすための部品(フック)。
 * 動かしている間は、一覧を透明にして(画面の後ろが見えるように)、指に付いてくる小さな表示(ゴースト)を出す。6px 以上動いてから、ドラッグとみなす。
 * ボタンの上から始めた操作は、ドラッグにしない。ウィンドウのフォーカスが外れたときも、ドラッグを取り消す。
 * @param opts `onActive` ドラッグが始まった/終わった / `onMove` 動かしている間の指の位置 / `onDrop` 落とした(ID と、落とした位置)
 * @returns `start`(行のポインタ押下に渡す)/ `ghost`(描画するゴースト)/ `dragging`(ドラッグ中か)
 */
export function usePickDrag(opts: {
  /** ドラッグが始まった/終わった */
  onActive?: (on: boolean) => void;
  /** 動かしている間の、指の位置(落とす場所の目印を出すため) */
  onMove?: (id: string, x: number, y: number) => void;
  /** 落とした(id と、落とした位置) */
  onDrop: (id: string, x: number, y: number) => void;
}) {
  const [drag, setDrag] = useState<{ x: number; y: number; label: string; icon: ReactNode } | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  // ドラッグの途中で一覧が閉じられても(Esc など)、「ドラッグ中」の状態を残さない
  const cancelRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cancelRef.current?.(), []);

  const start = (e: React.PointerEvent<HTMLElement>, id: string, label: string, icon: ReactNode) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button")) return; // ボタンの操作は、ドラッグにしない
    const el = e.currentTarget;
    const [sx, sy] = [e.clientX, e.clientY];
    let active = false;
    el.setPointerCapture(e.pointerId);
    const move = (m: PointerEvent) => {
      if (!active && Math.hypot(m.clientX - sx, m.clientY - sy) > 6) {
        active = true;
        optsRef.current.onActive?.(true);
      }
      if (active) {
        setDrag({ x: m.clientX, y: m.clientY, label, icon });
        optsRef.current.onMove?.(id, m.clientX, m.clientY);
      }
    };
    const end = (u: PointerEvent) => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", end);
      el.removeEventListener("pointercancel", end);
      el.removeEventListener("lostpointercapture", abort);
      window.removeEventListener("blur", abort);
      setDrag(null);
      cancelRef.current = null;
      if (active) {
        optsRef.current.onActive?.(false);
        if (u.type === "pointerup") optsRef.current.onDrop(id, u.clientX, u.clientY);
      }
    };
    // スクリーンショットなどでフォーカスが外れたときも、ドラッグを取り消す(「ドラッグ中」の表示を残さない)
    const abort = () => end(new PointerEvent("pointercancel"));
    el.addEventListener("lostpointercapture", abort);
    window.addEventListener("blur", abort);
    cancelRef.current = () => {
      el.removeEventListener("lostpointercapture", abort);
      window.removeEventListener("blur", abort);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", end);
      el.removeEventListener("pointercancel", end);
      cancelRef.current = null;
      if (active) optsRef.current.onActive?.(false);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  };

  const ghost = drag && (
    <div className="pick-ghost" style={{ left: drag.x, top: drag.y }}>
      {drag.icon}
      <span>{drag.label}</span>
    </div>
  );
  return { start, ghost, dragging: drag !== null };
}
