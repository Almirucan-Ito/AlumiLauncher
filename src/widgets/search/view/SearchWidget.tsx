import "./style.css";
import { useEffect, useRef } from "react";
import type { WidgetEnv } from "../../../launcher/modules/plugins/PluginModel";
import { t as appT } from "../../../launcher/shared/i18n/i18n";
import { t } from "../i18n";

/** 文字を入力する要素のタグ(キー操作の横取りを避けるために使う)。 */
const INPUT_TAGS = ["INPUT", "TEXTAREA"];

/**
 * 検索ウィジェット。入力した文字で、ホームのアイコンを絞り込む。`/` か Ctrl+F で入力欄へ、Enter で最初に見つかったものを開く、Esc でクリア。ウィジェットが外されたら、絞り込みも解く。
 * @param env ウィジェットの窓口
 */
export function SearchWidget({ env }: { env: WidgetEnv }) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName ?? "";
      if (
        (e.ctrlKey && e.key.toLowerCase() === "f") ||
        (e.key === "/" && !INPUT_TAGS.includes(tag) && !e.ctrlKey && !e.altKey)
      ) {
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // ウィジェットが外されたら、絞り込みも解く
  const { setQuery } = env;
  useEffect(() => () => setQuery(""), [setQuery]);
  return (
    <div className="wcard wsearch">
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <circle cx="11" cy="11" r="6.5" />
        <path d="M16 16l4.5 4.5" />
      </svg>
      <input
        ref={input}
        value={env.query}
        placeholder={t("searchPlaceholder")}
        spellCheck={false}
        onChange={(e) => env.setQuery(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation(); // 入力中の文字が、プリセットなどのキー操作にならないように
          if (e.key === "Enter") env.onSearchEnter();
          else if (e.key === "Escape") {
            env.setQuery("");
            input.current?.blur();
          }
        }}
      />
      {env.query && (
        <button className="wx" aria-label={appT("cancel")} onClick={() => env.setQuery("")}>
          ×
        </button>
      )}
    </div>
  );
}
