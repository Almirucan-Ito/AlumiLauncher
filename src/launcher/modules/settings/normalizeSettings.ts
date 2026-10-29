import { type Config, DEFAULT_SETTINGS, type Settings } from "../../shared/api/ApiModel";
import { rowsFor } from "../widgets/LayoutModel";

/**
 * 設定ファイルから読んだ設定に、足りない項目を、初期値で補う。
 * 古い設定ファイルでは、ウィジェットの一覧などが無い(`null`)ことがあるので、画面が使う形にそろえる。
 *
 * @param config 読み込んだ設定(読み込み前なら `null`)
 * @returns 画面が、そのまま使える設定
 */
export function normalizeSettings(config: Config | null): Settings {
  const merged = { ...DEFAULT_SETTINGS, ...config?.settings };
  return {
    ...merged,
    headerWidgets: Array.isArray(merged.headerWidgets) ? merged.headerWidgets : DEFAULT_SETTINGS.headerWidgets,
    footerWidgets: Array.isArray(merged.footerWidgets) ? merged.footerWidgets : DEFAULT_SETTINGS.footerWidgets,
    widgetScales: merged.widgetScales && typeof merged.widgetScales === "object" ? merged.widgetScales : {},
    widgetData: merged.widgetData && typeof merged.widgetData === "object" ? merged.widgetData : {},
    headerRows: rowsFor(merged.headerRows),
    footerRows: rowsFor(merged.footerRows),
  };
}
