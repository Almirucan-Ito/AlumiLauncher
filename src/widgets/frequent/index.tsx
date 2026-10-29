import { definePlugin } from "../../launcher/modules/plugins/PluginModel";
import { UsageWidget } from "../common/view/UsageWidget";
import manifest from "./widget.json";

/** 「よく使うもの」ウィジェット(起動回数の上位 5 個)。 */
export default definePlugin({
  widgets: {
    frequent: {
      component: () => <UsageWidget kind="frequent" />,
      cells: manifest.cells as [number, number, number],
    },
  },
});
