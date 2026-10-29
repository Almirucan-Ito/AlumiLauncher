/**
 * 色が明るいか調べる(明るい背景では、文字を暗くするため)。
 * @param hex `#rrggbb` の色
 * @returns 明るければ `true`(形式が違えば `false`)
 */
export function isLight(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
}
