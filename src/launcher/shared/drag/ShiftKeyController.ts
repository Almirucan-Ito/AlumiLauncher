/** Shift キーが押されているか。ドラッグ中は、ポインタのイベントの `shiftKey` だけに頼らず、キーボードのイベントでも記録しておく(Shift を押しただけでは、ポインタのイベントが来ないため)。ウィンドウから外れたら、押していないことにする。 */
let down = false;

if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => e.key === "Shift" && (down = true), true);
  window.addEventListener("keyup", (e) => e.key === "Shift" && (down = false), true);
  window.addEventListener("blur", () => (down = false));
}

/**
 * Shift キーがいま押されているかを返す。
 * @returns 押されていれば `true`
 */
export const shiftDown = () => down;
