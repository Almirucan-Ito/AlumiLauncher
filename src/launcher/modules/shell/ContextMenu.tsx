import { useLayoutEffect, useRef } from "react";
import { type MenuState } from "../../shared/ui/MenuModel";

/**
 * 右クリックのメニュー。中身(文字)の幅・高さを測ってから、画面の中に収まる位置へ寄せる(端で、文字が切れないように)。
 * 項目を押したら、その操作を実行して、メニューを閉じる。
 * @param menu 位置と項目
 * @param onClose メニューを閉じるとき
 */
export function ContextMenu({ menu, onClose }: { menu: MenuState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.left = `${Math.max(8, Math.min(menu.x, window.innerWidth - r.width - 8))}px`;
    el.style.top = `${Math.max(8, Math.min(menu.y, window.innerHeight - r.height - 8))}px`;
  }, [menu]);
  return (
    <div className="menu" ref={ref} style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}>
      {menu.actions.map((a) => (
        <button
          key={a.label}
          className={a.danger ? "danger" : undefined}
          onClick={() => {
            a.run();
            onClose();
          }}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
