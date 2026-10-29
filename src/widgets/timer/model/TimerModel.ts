/** タイマーの状態。`total` は設定した秒数、`endAt` は終了する時刻(動いていなければ `null`)、`left` は止めているときの残り秒数。 */
export type TimerState = { total: number; endAt: number | null; left: number };

/** タイマーの種類(集中 25 分・休憩 5 分・長い休憩 15 分)。`label` は、文言のキー。 */
export const TIMER_MODES: { min: number; label: "timerWork" | "timerBreak" | "timerLong" }[] = [
  { min: 25, label: "timerWork" },
  { min: 5, label: "timerBreak" },
  { min: 15, label: "timerLong" },
];

/**
 * 保存されたタイマーの状態を読む。
 * @param raw 保存されていた文字列
 * @returns 状態。無い・壊れているときは、集中 25 分の待機状態
 */
export function parseTimer(raw: string | undefined): TimerState {
  const fallback: TimerState = { total: 25 * 60, endAt: null, left: 25 * 60 };
  try {
    const s = JSON.parse(raw ?? "null") as TimerState | null;
    if (
      s &&
      typeof s.total === "number" &&
      typeof s.left === "number" &&
      (s.endAt === null || typeof s.endAt === "number")
    )
      return s;
  } catch {
    /* 壊れたデータは無かったことにする */
  }
  return fallback;
}
