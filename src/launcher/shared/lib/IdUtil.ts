/**
 * 新しい ID を作る。`crypto.randomUUID` が使えない環境でも動くよう、予備の作り方も持つ。
 * @returns 一意な文字列
 */
export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
