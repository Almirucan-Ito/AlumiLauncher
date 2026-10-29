/** ウィジェット・ミニアプリの補助(同意のキー・ID・表示名・URL)と、Tauri の中で動いているかの判定・Rust のコマンドの呼び出し。 */
import { isJa } from "../lib/LangUtil";
import { type MiniApp, type ModWidget } from "./ApiTypes";

/**
 * 外部通信の同意の記録のキー(ウィジェット用)。設定の `networkAllowed` に入る。
 * @param m ウィジェット
 * @returns `"widget:<名前>"`、ミニアプリの中のものは `"widget:<ミニアプリ>/<名前>"`
 */
export const widgetConsentKey = (m: ModWidget) => (m.kind === "mini" ? `widget:${m.app}/${m.id}` : `widget:${m.id}`);
/**
 * 外部通信の同意の記録のキー(ミニアプリ用)。
 * @param id ミニアプリのフォルダ名
 * @returns `"miniapp:<名前>"`
 */
export const miniConsentKey = (id: string) => `miniapp:${id}`;

/**
 * ウィジェットの、設定上の ID。
 * @param m ウィジェット
 * @returns 組み込みなら `builtin`(`clock` など)、ミニアプリの中なら `"mini:<ミニアプリ>/<名前>"`、それ以外は `"mod:<名前>"`
 */
export const widgetKey = (m: ModWidget) =>
  m.builtin ? m.builtin : m.kind === "mini" ? `mini:${m.app}/${m.id}` : `mod:${m.id}`;

/**
 * ウィジェットの表示名(英語表示のときは、`nameEn` があればそちら)。
 * @param m ウィジェット
 */
export const widgetLabel = (m: ModWidget) => (!isJa && m.nameEn ? m.nameEn : m.name);
/**
 * ウィジェットの説明(英語表示のときは、`descriptionEn` があればそちら)。
 * @param m ウィジェット
 */
export const widgetDesc = (m: ModWidget) => (!isJa && m.descriptionEn ? m.descriptionEn : m.description);
/**
 * ミニアプリの中のウィジェットの、持ち主のミニアプリの表示名(英語表示のときは、英語の名前があればそちら)。
 * @param m ウィジェット
 */
export const widgetAppLabel = (m: ModWidget) => (!isJa && m.appNameEn ? m.appNameEn : m.appName);

/**
 * ミニアプリの表示名(英語表示のときは、`nameEn` があればそちら)。
 * @param a ミニアプリ
 */
export const miniAppLabel = (a: MiniApp) => (!isJa && a.nameEn ? a.nameEn : a.name);
/**
 * ミニアプリの説明(英語表示のときは、`descriptionEn` があればそちら)。
 * @param a ミニアプリ
 */
export const miniAppDesc = (a: MiniApp) => (!isJa && a.descriptionEn ? a.descriptionEn : a.description);

/** パスを、`/` で区切ったまま、URL に使える形にする(区切りごとに `encodeURIComponent` する)。 */
const encodePath = (p: string) => p.split("/").map(encodeURIComponent).join("/");
/**
 * ミニアプリのファイルの URL を作る(アプリでは `miniapp` プロトコル。ブラウザでの確認用は、同梱のファイルを直接読む)。
 * @param id ミニアプリのフォルダ名
 * @param file ミニアプリの中のファイルの相対パス
 */
export const miniAppUrl = (id: string, file: string) =>
  isTauri
    ? `http://miniapp.localhost/${encodeURIComponent(id)}/${encodePath(file)}`
    : `/miniapps/${encodeURIComponent(id)}/${encodePath(file)}`;
/**
 * ウィジェットのファイルの URL を作る(`widget` プロトコル。ミニアプリの中のものは `miniapp` プロトコル)。
 * @param m ウィジェット
 * @param file ウィジェットの中のファイルの相対パス
 */
export const widgetUrl = (m: ModWidget, file: string) => {
  const mini = `${encodeURIComponent(m.app)}/widgets/${encodeURIComponent(m.id)}/${encodePath(file)}`;
  const mod = `${encodeURIComponent(m.id)}/${encodePath(file)}`;
  if (isTauri) return m.kind === "mini" ? `http://miniapp.localhost/${mini}` : `http://widget.localhost/${mod}`;
  return m.kind === "mini" ? `/miniapps/${mini}` : `/widgets/${mod}`; // ブラウザでの確認用は、同梱のファイルを直接読む
};

/** Tauri のアプリの中で動いているか(`false` なら、ブラウザでの見た目の確認用で、`api` はダミーの値を返す)。 */
export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * Rust 側のコマンドを呼ぶ(Tauri の `invoke` の薄い包み。ブラウザでの確認では読み込まれないよう、必要なときに読み込む)。
 * @param cmd コマンド名
 * @param args 引数
 * @returns コマンドの戻り値
 */
export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

/**
 * 名前の頭文字と、名前から決めた色のグラデーションで、仮のアイコン(SVG の data URI)を作る。ブラウザでの確認用と、アイコンの取得に失敗したときの代わり。
 * ファイル名に含まれる `<` `>` `&` などは、SVG が壊れないよう、必ずエスケープする。
 * @param name ファイル名
 */
export function fallbackIcon(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  // SVG に埋め込むので、ファイル名由来の文字(< > & など)は必ずエスケープする
  const raw = ([...name.trim()][0] ?? "?").toUpperCase();
  const letter = raw.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="hsl(${h},75%,62%)"/><stop offset="1" stop-color="hsl(${(h + 40) % 360},70%,45%)"/>
</linearGradient></defs>
<rect width="64" height="64" rx="15" fill="url(#g)"/>
<text x="32" y="43" font-size="30" font-family="Segoe UI,sans-serif" font-weight="600" text-anchor="middle" fill="white">${letter}</text></svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}
