import { isJa } from "./LangUtil";

/** 文言の中の `{名前}` を置き換える値(例: `{ n: 3 }`)。 */
export type MessageVars = Record<string, string | number>;

/**
 * 文言の中の `{名前}` を、値に置き換える。
 * @param template 文言(`{n} 個` など)
 * @param vars 置き換える値
 * @returns 置き換えた文字列
 */
export function formatMessage(template: string, vars?: MessageVars): string {
  let s = template;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}

/**
 * ミニアプリ・ウィジェットが、自分の文言(日本語・英語)を持つための道具。表示言語に合わせた文言を返す関数を作る。
 * @param ja 日本語の文言の表
 * @param en 英語の文言の表(`ja` と同じキー)
 * @returns キーから文言を取り出す関数(`{名前}` は `vars` で置き換える)
 */
export function defineMessages<K extends string>(ja: Record<K, string>, en: Record<K, string>) {
  const dict = isJa ? ja : en;
  return (key: K, vars?: MessageVars) => formatMessage(dict[key], vars);
}
