import { isJa } from "../lib/LangUtil";
import { en } from "./messages.en";
import { ja } from "./messages.ja";
// 表示言語は Windows の表示言語(WebView2 が navigator.language に反映)に合わせる。
// 日本語以外は英語で表示する。
//
// 用語の統一: 「ホーム」= 最初の画面 / 「フォルダ内」= フォルダを開いた画面 / 「表示数」= 1ページに並べる数

/** 文言のキー(`ja` のキーの名前)。 */
export type Key = keyof typeof ja;

/** 表示言語: Windows の表示言語(WebView2 が `navigator.language` に反映)が日本語なら `"ja"`、それ以外は `"en"`。 */
const lang = isJa ? "ja" : "en";
/** 表示言語に合わせた文言の表。 */
const dict = lang === "ja" ? ja : en;

/**
 * 文言を取り出す。
 * @param key 文言のキー
 * @param vars 文言の中の `{名前}` を置き換える値(例: `{ n: 3 }`)
 * @returns 表示言語に合わせた文字列
 */
export function t(key: Key, vars?: Record<string, string | number>): string {
  let s: string = dict[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}
