/** 表示言語が日本語か(Windows の表示言語。WebView2 が `navigator.language` に反映する)。ブラウザ以外で動かしたときは日本語として扱う。 */
export const isJa = (typeof navigator !== "undefined" ? navigator.language : "ja").toLowerCase().startsWith("ja");
