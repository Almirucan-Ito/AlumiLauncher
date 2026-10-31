import { HOME_ORDER_KEY } from "../home/HomeModel";

/** ファイル名に使えない文字(`\ / : * ? " < > |`)。制御文字も使えない(`hasControl`)。Rust 側 `check_new_file_name` と同じ決まり。 */
const FORBIDDEN = /[\\/:*?"<>|]/;
/** 制御文字(改行など)を含むか。 */
const hasControl = (s: string) => [...s].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127);
/** ファイル名の長さの上限(拡張子を含む)。 */
export const MAX_FILE_NAME = 200;
/** Windows が使えない予約名(拡張子の前の部分)。 */
const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/i;

/**
 * ファイル名を、名前の部分と、拡張子(`.` を含む)に分ける。名前を変えるときは、名前の部分だけを入力してもらい、拡張子はそのままにする。
 * 先頭の `.` だけのもの(`.gitignore`)は、拡張子の無い名前として扱う。
 * @param fileName 拡張子を含むファイル名(例: `Google Chrome.lnk`)
 * @returns `stem` 名前の部分(`Google Chrome`)/ `ext` 拡張子(`.lnk`。無ければ空)
 */
export function splitFileName(fileName: string): { stem: string; ext: string } {
  const i = fileName.lastIndexOf(".");
  return i > 0 ? { stem: fileName.slice(0, i), ext: fileName.slice(i) } : { stem: fileName, ext: "" };
}

/**
 * 入力した名前の部分が、ファイル名として使えるか調べる(使えないときは、理由を返す)。
 * @param stem 名前の部分(拡張子を除く)
 * @param ext 拡張子(`.` を含む。無ければ空)
 * @returns `ok`(使える)/ `empty`(空)/ `chars`(使えない文字)/ `edge`(前後の空白・終わりの `.`)/ `reserved`(予約名)/ `long`(長すぎる)/ `dot`(拡張子の無いファイルに `.` を含む名前)
 */
export function checkStem(stem: string, ext: string): "ok" | "empty" | "chars" | "edge" | "reserved" | "long" | "dot" {
  if (stem.trim() === "") return "empty";
  if (FORBIDDEN.test(stem) || hasControl(stem)) return "chars";
  if (stem !== stem.trim() || stem.endsWith(".")) return "edge";
  if (RESERVED.test(stem.split(".")[0])) return "reserved";
  if ([...(stem + ext)].length > MAX_FILE_NAME) return "long";
  if (ext === "" && stem.includes(".")) return "dot";
  return "ok";
}

/**
 * ファイルのパスが変わったとき、並び順の記録(`orders`)の中の、古いパスを、新しいパスにする。
 * ホームの並び(`HOME_ORDER_KEY`)は `i:<パス>`、フォルダ内の並びは、パスそのもので覚えている。パスの大文字・小文字は区別しない(Windows のため)。
 * @param orders いまの並び順の記録(フォルダの ID → 並び)
 * @param oldPath 変わる前のパス
 * @param newPath 変わったあとのパス
 * @returns 新しい記録(元の記録は変えない)
 */
export function replacePathInOrders(
  orders: Record<string, string[]> | undefined,
  oldPath: string,
  newPath: string,
): Record<string, string[]> {
  const norm = (p: string) => p.toLowerCase().replace(/\//g, "\\");
  const old = norm(oldPath);
  const out: Record<string, string[]> = {};
  for (const [key, list] of Object.entries(orders ?? {})) {
    out[key] = list.map((k) => {
      if (key === HOME_ORDER_KEY) return k.startsWith("i:") && norm(k.slice(2)) === old ? `i:${newPath}` : k;
      return norm(k) === old ? newPath : k;
    });
  }
  return out;
}
