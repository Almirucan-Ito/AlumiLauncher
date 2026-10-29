import { definePlugin } from "../../launcher/modules/plugins/PluginModel";
import { ClockWidget } from "./view/ClockWidget";
import manifest from "./widget.json";

/** 時計ウィジェット(時刻と日付)。 */
export default definePlugin({
  widgets: {
    clock: { component: ClockWidget, cells: manifest.cells as [number, number, number] },
  },
});
