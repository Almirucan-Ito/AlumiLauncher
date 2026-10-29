import { definePlugin } from "../../launcher/modules/plugins/PluginModel";
import { TodoWidget } from "./view/TodoWidget";
import manifest from "./widget.json";

/** ToDo ウィジェット(ミニアプリ「予定とToDo」のデータを使う)。 */
export default definePlugin({
  widgets: {
    todo: { component: TodoWidget, cells: manifest.cells as [number, number, number] },
  },
});
