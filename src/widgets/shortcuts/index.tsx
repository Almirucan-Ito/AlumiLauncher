import { definePlugin } from "../../launcher/modules/plugins/PluginModel";
import { ShortcutsWidget } from "./view/ShortcutsWidget";
import manifest from "./widget.json";

/** ショートカットウィジェット(ホームのアイコン・フォルダを、ドラッグして入れておく。1 マスに 1 つ)。 */
export default definePlugin({
  widgets: {
    shortcuts: { component: ShortcutsWidget, cells: manifest.cells as [number, number, number] },
  },
});
