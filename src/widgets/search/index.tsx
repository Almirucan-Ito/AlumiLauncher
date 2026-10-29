import { definePlugin } from "../../launcher/modules/plugins/PluginModel";
import { SearchWidget } from "./view/SearchWidget";
import manifest from "./widget.json";

/** 検索ウィジェット(入力した文字で、ホームのアイコンを絞り込む)。 */
export default definePlugin({
  widgets: {
    search: { component: SearchWidget, cells: manifest.cells as [number, number, number] },
  },
});
