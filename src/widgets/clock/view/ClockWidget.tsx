import { useEffect, useState } from "react";
import { pad2 } from "../../../launcher/shared/lib/FormatUtil";
import { isJa } from "../../../launcher/shared/lib/LangUtil";

/** 現在時刻(15 秒ごとに更新)を返す。非表示(トレイ常駐)中は更新せず、表示に戻ったときに、すぐ更新する。 */
function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    // 非表示(トレイ常駐)中は更新しない。表示に戻ったときに即更新する
    const tick = () => !document.hidden && setNow(new Date());
    const id = setInterval(tick, 15_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return now;
}

/** 時計ウィジェット。時刻と日付を出す。時計だけが再描画されるよう、App から分離してある(全タイルを再描画しない)。 */
export function ClockWidget() {
  const now = useClock();
  const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  const lang = navigator.language;
  const date = isJa
    ? `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${now.toLocaleDateString(lang, { weekday: "long" })}`
    : now.toLocaleDateString(lang, { year: "numeric", month: "long", day: "numeric", weekday: "long" });
  return (
    <div className="clock" data-tauri-drag-region>
      <div className="time">{time}</div>
      <div className="date">{date}</div>
    </div>
  );
}
