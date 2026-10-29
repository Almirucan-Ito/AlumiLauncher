/**
 * 数を 2 桁(先頭 0 埋め)の文字列にする。
 * @param n 数
 * @returns `"07"` のような文字列
 */
export const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * 秒数を `分:秒` の文字列にする。
 * @param s 秒数(負の値は 0)
 * @returns `"3:07"` のような文字列
 */
export const fmtTime = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${pad2(t % 60)}`;
};
