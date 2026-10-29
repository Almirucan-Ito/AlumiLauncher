/**
 * 値を範囲(`lo`〜`hi`)に収める。
 * @param v 値
 * @param lo 下限
 * @param hi 上限
 * @returns 収めた値
 */
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * 値を 0〜1 に収める(音量などに使う)。
 * @param v 値
 * @returns 0〜1 に収めた値
 */
export const clamp01 = (v: number) => clamp(v, 0, 1);
