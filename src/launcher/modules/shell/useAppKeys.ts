import { api, type Settings } from "../../shared/api/ApiModel";
import { useEscapeKey, usePresetKeys, useReloadKeys } from "./useGlobalKeys";

/**
 * `App` のキー操作(Esc で閉じる・Ctrl+R などで再読み込み・プリセットの切り替え)。何が開いているかで、効くものが変わる。
 * @param on 何を開いているか
 * @param settings 設定
 * @param close 閉じる処理(ミニアプリ・追加の画面・メニュー・設定)
 * @param reloadAll すべて読み直す関数
 * @param applyPresetMode プリセットを切り替える関数
 */
export function useAppKeys({
  on,
  settings,
  close,
  reloadAll,
  applyPresetMode,
}: {
  on: {
    folderOpen: boolean;
    renaming: boolean;
    deleting: boolean;
    miniOpen: boolean;
    picking: boolean;
    menu: boolean;
    settings: boolean;
  };
  settings: Settings;
  close: { mini: () => void; pickers: () => void; menu: () => void; settings: () => void };
  reloadAll: () => void;
  applyPresetMode: (enabled: boolean, preset: number, count?: number) => void;
}) {
  useEscapeKey(on, settings.desktopMode, { ...close, hideWindow: () => api.windowAction("hide") });
  const dialogOpen = on.renaming || on.deleting || on.settings || on.menu;
  const blocked = dialogOpen || on.miniOpen || on.picking;
  useReloadKeys(dialogOpen, blocked, reloadAll);
  usePresetKeys(({ dir, n }) => {
    const count = settings.presetCount;
    if (!settings.presetsEnabled || count < 2 || blocked) return;
    const next = n !== undefined ? n : ((settings.preset - 1 + (dir ?? 0) + count) % count) + 1;
    if (next >= 1 && next <= count && next !== settings.preset) applyPresetMode(true, next);
  });
}
