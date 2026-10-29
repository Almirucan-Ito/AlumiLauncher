import { useEffect, useRef } from "react";

/** 文字の入力欄にいるか(キー操作を、ショートカットに取られないようにするための判定)。 */
function isTyping(e: KeyboardEvent): boolean {
  const tag = (e.target as HTMLElement | null)?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA";
}

/** 開いているもの(Esc で、どれを閉じるかを決める)。 */
export type OpenLayers = {
  /** フォルダを開いているか(フォルダ内の画面が、自分で Esc を扱う) */
  folderOpen: boolean;
  renaming: boolean;
  deleting: boolean;
  miniOpen: boolean;
  picking: boolean;
  menu: boolean;
  settings: boolean;
};

/**
 * Esc キー。開いているものを、手前から順に閉じる。何も開いていなければ、ウィンドウを隠す(常駐)。
 * フォルダ・名前の変更・削除の確認は、その画面が自分で Esc を扱うので、ここでは何もしない。
 *
 * @param layers 開いているもの
 * @param desktopMode デスクトップモードか(デスクトップモードでは、隠さない)
 * @param close 閉じる操作(ミニアプリ・各一覧・メニュー・設定・ウィンドウ)
 */
export function useEscapeKey(
  layers: OpenLayers,
  desktopMode: boolean,
  close: {
    mini: () => void;
    pickers: () => void;
    menu: () => void;
    settings: () => void;
    hideWindow: () => void;
  },
) {
  const closeRef = useRef(close);
  closeRef.current = close;
  const { folderOpen, renaming, deleting, miniOpen, picking, menu, settings } = layers;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || folderOpen || renaming || deleting) return;
      const c = closeRef.current;
      if (miniOpen) return c.mini();
      if (picking) return c.pickers();
      if (menu) c.menu();
      else if (settings) c.settings();
      else if (!desktopMode) c.hideWindow(); // デスクトップモードでは、隠さない
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [folderOpen, renaming, deleting, miniOpen, picking, menu, settings, desktopMode]);
}

/**
 * R キー・F5 で、再読み込みする。
 * F5 は、ブラウザ標準の「ページの更新」(画面ごとの読み込み直し)にならないよう、常に止める。
 *
 * @param dialogOpen ダイアログ・設定・メニューのどれかを開いているか(F5 の再読み込みをしない)
 * @param anyOverlay 上に加えて、ミニアプリ・各一覧も開いているか(R の再読み込みをしない)
 * @param reload 再読み込みする関数
 */
export function useReloadKeys(dialogOpen: boolean, anyOverlay: boolean, reload: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.altKey) return;
      if (e.key === "F5") {
        e.preventDefault();
        if (dialogOpen) return;
        reload();
        return;
      }
      if (e.key.toLowerCase() !== "r" || e.ctrlKey) return;
      if (isTyping(e) || anyOverlay) return;
      e.preventDefault();
      reload();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialogOpen, anyOverlay, reload]);
}

/**
 * プリセットのキー操作(文字の入力中は除く)。
 *   ・数字キー 1〜9(Alt や Ctrl を押しながらでも可) … そのプリセットへ
 *   ・Alt+←/→ または Home / End … 前・次のプリセットへ(端からは反対側へ回る)
 * Fn キーはキーボード側で処理されて、アプリには届かない。そのため、Fn+数字・Fn+矢印が数字キー・Home / End などになるキーボードなら、
 * 「Fn を押しながら」でも使える。F5 は再読み込みに使っているので、F キーはプリセットには使わない。
 *
 * @param onCommand 操作を受け取る関数。`n` は番号の指定、`dir` は前(-1)・次(1)。呼ぶかどうかの判断(ダイアログを開いている間は無視する、など)は、受け取る側で行う
 */
export function usePresetKeys(onCommand: (cmd: { dir?: number; n?: number }) => void) {
  const ref = useRef(onCommand);
  ref.current = onCommand;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || e.metaKey || e.shiftKey) return;
      const digit = /^(Digit|Numpad)([1-9])$/.exec(e.code);
      if (digit) {
        e.preventDefault();
        return ref.current({ n: Number(digit[2]) });
      }
      if (e.ctrlKey) return;
      const dir =
        e.altKey && e.key === "ArrowLeft"
          ? -1
          : e.altKey && e.key === "ArrowRight"
            ? 1
            : !e.altKey && e.key === "Home"
              ? -1
              : !e.altKey && e.key === "End"
                ? 1
                : 0;
      if (!dir) return;
      e.preventDefault();
      ref.current({ dir });
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
}
