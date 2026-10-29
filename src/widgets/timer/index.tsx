import { definePlugin } from "../../launcher/modules/plugins/PluginModel";
import { appData } from "../../launcher/shared/api/AppDataModel";
import { TimerWidget } from "./view/TimerWidget";
import manifest from "./widget.json";

/** タイマーウィジェット(集中 25 分・休憩のタイマー)。 */
export default definePlugin({
  widgets: {
    timer: { component: TimerWidget, cells: manifest.cells as [number, number, number] },
  },
  hooks: {
    // 起動時に、保存してあるタイマーの状態を読んでおく(ウィジェットが出るとき、すぐ使えるように)
    onStart: () => void appData.load("widget", "timer"),
  },
});
