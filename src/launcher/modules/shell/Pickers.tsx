import { api, type ModWidget, type Settings } from "../../shared/api/ApiModel";
import { t } from "../../shared/i18n/i18n";
import { MiniAppPicker } from "../miniapps/MiniAppPicker";
import { type useMiniApps } from "../miniapps/useMiniApps";
import { type useStorageManagement } from "../miniapps/useStorageManagement";
import { StartAppPicker } from "../start-apps/StartAppPicker";
import { type useWidgetBars } from "../widgets/useWidgetBars";
import { WidgetPicker } from "../widgets/WidgetPicker";

/** 追加の画面(ウィジェット・ミニアプリ・スタートメニュー)の、どれを開いているか。 */
export interface PickingState {
  widget: boolean;
  mini: boolean;
  start: boolean;
}

/** `Pickers` に、`App` から渡すもの。 */
export interface PickersProps {
  picking: PickingState;
  /** 指定した画面を閉じる */
  close: (which: keyof PickingState) => void;
  settings: Pick<Settings, "headerWidgets" | "footerWidgets">;
  mods: ModWidget[];
  widgets: Pick<
    ReturnType<typeof useWidgetBars>,
    "toggleWidget" | "onWidgetDragging" | "onWidgetPreview" | "onDropWidget"
  >;
  miniApps: Pick<ReturnType<typeof useMiniApps>, "minis" | "openMini" | "addMiniToHome">;
  storage: Pick<ReturnType<typeof useStorageManagement>, "storage" | "clearStorage" | "clearAllStorage">;
  flash: (msg: string) => void;
  /** スタートメニューから追加したあと: ホームの表示を更新する */
  onStartAdded: (path: string, name: string) => void;
}

/** 追加の画面(ウィジェットの追加・ミニアプリの一覧・スタートメニューから追加)。開いているものだけを描く。 */
export function Pickers({
  picking,
  close,
  settings,
  mods,
  widgets,
  miniApps,
  storage,
  flash,
  onStartAdded,
}: PickersProps) {
  return (
    <>
      {picking.widget && (
        <WidgetPicker
          header={settings.headerWidgets}
          footer={settings.footerWidgets}
          mods={mods}
          onToggle={widgets.toggleWidget}
          onOpenModDir={(w) =>
            (w.kind === "mini" ? api.openMiniAppWidgetsDir(w.app) : api.openWidgetDir(w.id)).catch((err) =>
              flash(String(err)),
            )
          }
          onOpenRoot={() => api.openWidgetsRoot().catch((err) => flash(String(err)))}
          onDragActive={widgets.onWidgetDragging}
          onPreview={widgets.onWidgetPreview}
          onDropWidget={widgets.onDropWidget}
          storage={storage.storage}
          onClear={storage.clearStorage}
          onClearAll={storage.clearAllStorage}
          onClose={() => close("widget")}
        />
      )}

      {picking.mini && (
        <MiniAppPicker
          apps={miniApps.minis}
          onOpen={(a) => {
            close("mini");
            miniApps.openMini(a);
          }}
          onAddHome={miniApps.addMiniToHome}
          onOpenDir={(a) => api.openMiniAppDir(a.id).catch((err) => flash(String(err)))}
          onOpenRoot={() => api.openMiniAppsRoot().catch((err) => flash(String(err)))}
          storage={storage.storage}
          onClear={storage.clearStorage}
          onClearAll={storage.clearAllStorage}
          onClose={() => close("mini")}
        />
      )}

      {picking.start && (
        <StartAppPicker
          onAdded={onStartAdded}
          onError={(err) => flash(t("failed", { err }))}
          onClose={() => close("start")}
        />
      )}
    </>
  );
}
