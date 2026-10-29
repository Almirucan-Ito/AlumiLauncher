/** ウィジェット・ミニアプリの一覧に使う、フラットデザインのアイコン(色の四角に白い図形) */

/** アイコンの背景の色(追加ウィジェットとミニアプリの標準)。組み込みウィジェットのアイコンは、それぞれのフォルダの `icon.svg`。 */
const COLORS: Record<string, string> = {
  mod: "#a855f7",
  mini: "#565ae8",
};

/** アイコンの図形(白の線画。32x32 の中に描く)。 */
const GLYPHS: Record<string, JSX.Element> = {
  mod: <path d="M17.5 8.5l-5 8h4l-1.5 7 6-9h-4.2z" fill="#fff" stroke="none" />,
  mini: (
    <>
      <rect x="9" y="9" width="6" height="6" rx="1.5" fill="#fff" stroke="none" />
      <rect x="17" y="9" width="6" height="6" rx="1.5" fill="#fff" stroke="none" opacity=".75" />
      <rect x="9" y="17" width="6" height="6" rx="1.5" fill="#fff" stroke="none" opacity=".75" />
      <rect x="17" y="17" width="6" height="6" rx="1.5" fill="#fff" stroke="none" opacity=".45" />
    </>
  ),
};

/**
 * ウィジェット・ミニアプリの一覧に使う、フラットデザインのアイコン(色の四角に白い図形)。
 * @param kind `"mod"`(追加ウィジェットの標準)か `"mini"`(ミニアプリの標準)。`mini:` で始まる ID は `"mini"`、それ以外は `"mod"` として扱う
 * @param size 一辺の大きさ(px。既定 36)
 */
export function FlatIcon({ kind, size = 36 }: { kind: string; size?: number }) {
  const key = kind in COLORS ? kind : kind.startsWith("mini:") ? "mini" : "mod";
  return (
    <svg className="flat-icon" viewBox="0 0 32 32" width={size} height={size} aria-hidden>
      <rect width="32" height="32" rx="8" fill={COLORS[key]} />
      <g fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {GLYPHS[key]}
      </g>
    </svg>
  );
}
