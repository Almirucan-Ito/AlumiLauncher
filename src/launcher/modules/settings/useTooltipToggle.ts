import { useEffect } from "react";

/**
 * ボタンなどの説明(ツールチップ)は、設定でオフのとき出さない: カーソルが乗った要素の `title` を、一時的に退避する(オンに戻すと戻す)。
 * @param showTooltips 説明を出すか(設定)
 */
export function useTooltipToggle(showTooltips: boolean) {
  useEffect(() => {
    if (showTooltips) {
      document.querySelectorAll<HTMLElement>("[data-tt]").forEach((el) => {
        el.setAttribute("title", el.dataset.tt ?? "");
        el.removeAttribute("data-tt");
      });
      return;
    }
    const strip = (e: Event) => {
      const el = (e.target as HTMLElement | null)?.closest?.("[title]");
      if (el) {
        el.setAttribute("data-tt", el.getAttribute("title") ?? "");
        el.removeAttribute("title");
      }
    };
    document.addEventListener("pointerover", strip, true);
    return () => document.removeEventListener("pointerover", strip, true);
  }, [showTooltips]);
}
