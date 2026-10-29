import { defineMessages } from "../../launcher/shared/lib/MessageUtil";

/** タイマーウィジェットの文言。 */
export const t = defineMessages(
  {
    timerWork: "集中",
    timerBreak: "休憩",
    timerLong: "長休憩",
    timerStart: "開始",
    timerPause: "一時停止",
    timerReset: "リセット",
    timerDone: "{m} 分のタイマーが終わりました",
  },
  {
    timerWork: "Focus",
    timerBreak: "Break",
    timerLong: "Long break",
    timerStart: "Start",
    timerPause: "Pause",
    timerReset: "Reset",
    timerDone: "Your {m}-minute timer is done",
  },
);
