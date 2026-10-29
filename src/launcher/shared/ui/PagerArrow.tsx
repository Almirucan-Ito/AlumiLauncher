/** ページ送りの矢印の絵(左向きは、右向きを反転して描く)。 */
export const Arrow = ({ dir }: { dir: "left" | "right" }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" style={dir === "left" ? { transform: "scaleX(-1)" } : undefined}>
    <path d="M8 5.5v13l10-6.5z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);
