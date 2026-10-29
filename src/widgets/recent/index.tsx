import { definePlugin } from "../../launcher/modules/plugins/PluginModel";
import { UsageWidget } from "../common/view/UsageWidget";
import manifest from "./widget.json";

/** 「最近開いた」ウィジェット(直近に起動したもの 5 個)。 */
export default definePlugin({
  widgets: {
    recent: {
      component: () => <UsageWidget kind="recent" />,
      cells: manifest.cells as [number, number, number],
    },
  },
});
