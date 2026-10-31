import { useEffect, useState } from "react";
import { api } from "../../shared/api/ApiModel";
import { BARS_MIN_HEIGHT, BARS_MIN_WIDTH } from "../widgets/WidgetBar";

/** この高さ(px)より低いウィンドウは、小さい表示(compact: ラベルを消して、アイコンだけ詰めて並べる)にする。この値で `.app.compact` のクラスが付き、`compact.css` が効く(CSS 側には、高さの数値は無い)。 */
const COMPACT_HEIGHT = 200;

/**
 * ウィンドウの状態(大きさによる表示の切り替えと、最大化)を、画面に反映するために追う。
 *
 * @returns
 * - `compact`: とても小さいウィンドウ(高さ 200px 未満)。時計とラベルを消して、アイコンだけを詰めて並べる
 * - `smallWin`: 小さいウィンドウ。ヘッダー・フッターのウィジェットを出さない
 * - `maximized`: 最大化されているか
 */
export function useWindowMode() {
  const [maximized, setMaximized] = useState(false);
  const [compact, setCompact] = useState(() => window.innerHeight < COMPACT_HEIGHT);
  const [smallWin, setSmallWin] = useState(
    () => window.innerHeight < BARS_MIN_HEIGHT || window.innerWidth < BARS_MIN_WIDTH,
  );

  useEffect(() => {
    const onResize = () => {
      setCompact(window.innerHeight < COMPACT_HEIGHT);
      setSmallWin(window.innerHeight < BARS_MIN_HEIGHT || window.innerWidth < BARS_MIN_WIDTH);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    let off: (() => void) | undefined;
    let dead = false;
    api.onMaximizedChange(setMaximized).then((fn) => (dead ? fn() : (off = fn)));
    return () => {
      dead = true;
      off?.();
    };
  }, []);

  return { compact, smallWin, maximized };
}
