import type { LauncherHooks, MiniBridge, PluginModule, WidgetPlugin } from "./PluginModel";

/**
 * `src/miniapps/<id>/index.ts(x)` と `src/widgets/<id>/index.ts(x)` を、自動で集める(フォルダを足すだけで、ランチャーに載る。ここを書き換える必要はない)。
 * ランチャー本体は、個々のミニアプリ・ウィジェットを名前で読み込まない。必ず、ここで集めたものを通して使う。
 */
const modules: PluginModule[] = Object.values({
  ...import.meta.glob<PluginModule>("../../../miniapps/*/index.{ts,tsx}", { eager: true, import: "default" }),
  ...import.meta.glob<PluginModule>("../../../widgets/*/index.{ts,tsx}", { eager: true, import: "default" }),
});

/** 組み込みのウィジェット(`widget.json` の `builtin` の名前 → 部品)。 */
export const widgetPlugins: Record<string, WidgetPlugin> = Object.assign({}, ...modules.map((m) => m.widgets ?? {}));
/** ミニアプリが呼べる、ランチャー側の機能。 */
export const miniBridges: MiniBridge[] = modules.flatMap((m) => m.bridges ?? []);
/** ランチャーの動きに合わせて呼ぶ関数。 */
export const launcherHooks: LauncherHooks[] = modules.flatMap((m) => (m.hooks ? [m.hooks] : []));
