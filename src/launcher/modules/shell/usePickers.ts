import { useState } from "react";
import { type PickingState } from "./Pickers";

/**
 * 追加の画面(ウィジェットの追加・ミニアプリの一覧・スタートメニューから追加)を、開く・閉じる。
 * ミニアプリの一覧を開いているか(`pickingMini`)は、ミニアプリの機能(`useMiniApps`)が持つので、受け取る。
 * @param pickingMini ミニアプリの一覧を開いているか
 * @param setPickingMini ミニアプリの一覧を開く/閉じる
 * @param refreshMods ウィジェットの一覧を読み直す関数
 * @param refreshMinis ミニアプリの一覧を読み直す関数
 * @param refreshStorage データの大きさを読み直す関数
 * @returns 開いている画面 `picking`・どれか開いているか `anyPicking`・閉じる関数 `close` / `closeAll`・開く関数
 */
export function usePickers({
  pickingMini,
  setPickingMini,
  refreshMods,
  refreshMinis,
  refreshStorage,
}: {
  pickingMini: boolean;
  setPickingMini: (v: boolean) => void;
  refreshMods: () => void;
  refreshMinis: () => void;
  refreshStorage: () => void;
}) {
  const [pickingWidget, setPickingWidget] = useState(false);
  const [pickingStart, setPickingStart] = useState(false);
  const picking: PickingState = { widget: pickingWidget, mini: pickingMini, start: pickingStart };
  const anyPicking = pickingWidget || pickingMini || pickingStart;
  return {
    picking,
    anyPicking,
    /** 指定した画面を閉じる。 */
    close: (which: keyof PickingState) =>
      (which === "widget" ? setPickingWidget : which === "mini" ? setPickingMini : setPickingStart)(false),
    /** どの画面も閉じる。 */
    closeAll: () => {
      setPickingWidget(false);
      setPickingMini(false);
      setPickingStart(false);
    },
    /** ウィジェットの追加画面を開く(一覧と、データの大きさを読み直してから)。 */
    openWidgetPicker: () => {
      refreshMods();
      refreshStorage();
      setPickingWidget(true);
    },
    /** ミニアプリの一覧を開く(一覧と、データの大きさを読み直してから)。 */
    openMiniPicker: () => {
      refreshMinis();
      refreshStorage();
      setPickingMini(true);
    },
    /** 「スタートメニューから追加」の画面を開く。 */
    openStartPicker: () => setPickingStart(true),
  };
}
