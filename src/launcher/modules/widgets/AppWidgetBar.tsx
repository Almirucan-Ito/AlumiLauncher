import { type ModWidget, type Settings } from "../../shared/api/ApiModel";
import { type WidgetEnv } from "../plugins/PluginModel";
import { type useWidgetBars } from "./useWidgetBars";
import { WidgetBar } from "./WidgetBar";

/** `AppWidgetBar` に、`App` から渡すもの(ヘッダーとフッターで共通)。 */
export interface AppWidgetBarProps {
  settings: Settings;
  widgets: Pick<
    ReturnType<typeof useWidgetBars>,
    "layoutOf" | "onWidgetMenu" | "onWidgetMove" | "onWidgetDragging" | "onBarMenu" | "dropPreview" | "onWidgetPreview"
  >;
  mods: ModWidget[];
  modsLoaded: boolean;
  env: WidgetEnv;
  /** 外部との通信の同意を求める */
  onAskNetwork: (m: ModWidget) => void;
}

/**
 * ヘッダー・フッターのウィジェットの帯。設定から、その帯の並び・段数を取って、`WidgetBar` に渡す。
 * @param bar どちらの帯か
 */
export function AppWidgetBar({
  bar,
  settings,
  widgets,
  mods,
  modsLoaded,
  env,
  onAskNetwork,
}: AppWidgetBarProps & { bar: "header" | "footer" }) {
  const header = bar === "header";
  return (
    <WidgetBar
      bar={bar}
      ids={header ? settings.headerWidgets : settings.footerWidgets}
      layout={widgets.layoutOf(bar)}
      mods={mods}
      env={env}
      onMenu={widgets.onWidgetMenu}
      onMove={widgets.onWidgetMove}
      onDragging={widgets.onWidgetDragging}
      dragDelayMs={settings.dragDelayMs}
      modsLoaded={modsLoaded}
      networkAllowed={settings.networkAllowed}
      onAskNetwork={onAskNetwork}
      rows={header ? settings.headerRows : settings.footerRows}
      onBarMenu={widgets.onBarMenu}
      preview={widgets.dropPreview}
      onPreview={widgets.onWidgetPreview}
    />
  );
}
