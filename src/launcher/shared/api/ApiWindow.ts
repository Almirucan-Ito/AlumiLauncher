// ウィンドウ: 大きさ・最小化と最大化・前面へ・ドラッグ&ドロップの受け取り
// `api`(ApiModel.ts)に、他の領域といっしょに、まとめて渡される。

import { invoke, isTauri } from "./ApiHelpers";
import { type DropEvent } from "./ApiTypes";

/** ウィンドウ: 大きさ・最小化と最大化・前面へ・ドラッグ&ドロップの受け取り */
export const windowApi = {
  /** ウィンドウを前に出す(タイマー終了の通知など)。 */
  async bringToFront(): Promise<void> {
    if (!isTauri) return;
    return invoke<void>("bring_to_front");
  },
  /**
   * ウィンドウの大きさを変える。
   * @param width 幅(論理 px)
   * @param height 高さ(論理 px)
   */
  async setWindowSize(width: number, height: number): Promise<void> {
    if (!isTauri) return;
    const { getCurrentWindow, LogicalSize } = await import("@tauri-apps/api/window");
    await getCurrentWindow().setSize(new LogicalSize(width, height));
  },
  /**
   * エクスプローラーからのドラッグ&ドロップを受け取る。
   * @param cb イベントを受け取る関数
   * @returns 登録を解除する関数
   */
  async onDrop(cb: (e: DropEvent) => void): Promise<() => void> {
    if (!isTauri) return () => {};
    const { getCurrentWebview } = await import("@tauri-apps/api/webview");
    return getCurrentWebview().onDragDropEvent((ev) => {
      const p = ev.payload;
      if (p.type === "enter" || p.type === "over") cb({ type: "over" });
      else if (p.type === "leave") cb({ type: "leave" });
      else if (p.type === "drop") cb({ type: "drop", paths: p.paths });
    });
  },
  /**
   * ウィンドウの操作(最小化・最大化の切り替え・隠す)。隠す処理は Rust 側で行う(非表示中は、メモリ使用量を下げるため)。
   * @param action `"minimize"` / `"maximize"` / `"hide"`
   */
  async windowAction(action: "minimize" | "maximize" | "hide"): Promise<void> {
    if (!isTauri) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const w = getCurrentWindow();
    if (action === "minimize") await w.minimize();
    else if (action === "maximize") await w.toggleMaximize();
    else await invoke("hide_window"); // 隠す処理は Rust 側(非表示中はメモリ使用量を下げる)
  },
  /**
   * 最大化状態の変化を通知してもらう(登録した時点の状態も、すぐ通知する)。
   * @param cb 最大化されているかを受け取る関数
   * @returns 登録を解除する関数
   */
  async onMaximizedChange(cb: (maximized: boolean) => void): Promise<() => void> {
    if (!isTauri) return () => {};
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const w = getCurrentWindow();
    cb(await w.isMaximized());
    return w.onResized(async () => cb(await w.isMaximized()));
  },
};
