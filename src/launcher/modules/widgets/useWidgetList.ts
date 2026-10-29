import { useCallback, useEffect, useState } from "react";
import { api, type ModWidget } from "../../shared/api/ApiModel";

/**
 * ウィジェットの一覧(追加ウィジェット・組み込みの定義)。起動時と、`refreshMods` を呼ぶたび(ウィジェットの追加画面を開くとき)に読み直す。
 * @returns 一覧 `mods`・読み込み済みか `modsLoaded`・読み直す関数 `refreshMods`
 */
export function useWidgetList() {
  const [mods, setMods] = useState<ModWidget[]>([]);
  const [modsLoaded, setModsLoaded] = useState(false);
  const refreshMods = useCallback(
    () =>
      api
        .listWidgets()
        .then((r) => {
          setMods(r);
          setModsLoaded(true);
        })
        .catch(() => {}),
    [],
  );
  useEffect(() => {
    refreshMods();
  }, [refreshMods]);
  return { mods, modsLoaded, refreshMods };
}
