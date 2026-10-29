// ミニアプリ・ウィジェットの検査(`npm run check:miniapps`)。
//   - miniapp.json / widget.json が読めて、必須の項目・権限の名前が正しいか
//   - entry / icon のファイルが、フォルダの中に実在するか
//   - index.html の中の <script> が、JavaScript として文法が正しいか
// 本体(TypeScript)とは独立しているため、ESLint / tsc の対象外にしている分を、ここで補う。
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = fileURLToPath(new URL("../src/", import.meta.url));
// 使える権限の名前は、スキーマ(schemas/miniapp.schema.json)が、元(Rust のビルドも、同じものを読む)
const SCHEMA = JSON.parse(
  readFileSync(fileURLToPath(new URL("../schemas/miniapp.schema.json", import.meta.url)), "utf8"),
);
const PERMISSIONS = new Set(SCHEMA.properties.permissions.items.enum);
const errors = [];

/** 問題を 1 件記録する。 */
const fail = (file, msg) => errors.push(`${relative(ROOT, file)}: ${msg}`);

/**
 * フォルダの中の、マニフェスト(指定した名前)を持つフォルダを集める(`_examples` の中も含む)。
 * @param {string} dir 探すフォルダ
 * @param {string} manifest マニフェストのファイル名
 * @returns {string[]} マニフェストのあるフォルダ
 */
function findDirs(dir, manifest) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (!statSync(p).isDirectory()) continue;
    if (existsSync(join(p, manifest))) out.push(p);
    out.push(...findDirs(p, manifest));
  }
  return out;
}

/**
 * 1 つのフォルダを検査する。
 * @param {string} dir フォルダ
 * @param {string} manifestName マニフェストのファイル名
 */
function check(dir, manifestName) {
  const mf = join(dir, manifestName);
  let m;
  try {
    const text = readFileSync(mf, "utf8");
    m = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text); // BOM 付きも読む
  } catch (e) {
    return fail(mf, `JSON として読めません (${e.message})`);
  }
  if (typeof m.name !== "string" || !m.name.trim()) fail(mf, "name が必要です");
  if (manifestName === "miniapp.json") {
    for (const p of m.permissions ?? []) if (!PERMISSIONS.has(p)) fail(mf, `知らない権限です: ${p}`);
    if (m.url && (m.permissions ?? []).length) fail(mf, "url のミニアプリは permissions を指定できません");
  }
  if (m.icon && !existsSync(join(dir, m.icon))) fail(mf, `icon が見つかりません: ${m.icon}`);
  if (m.builtin) return checkBuiltin(dir, mf, m.builtin);
  if (m.url) return;
  const entry = join(dir, m.entry || "index.html");
  if (!existsSync(entry)) return fail(mf, `entry が見つかりません: ${m.entry || "index.html"}`);
  const html = readFileSync(entry, "utf8");
  /** @param {string} code @param {string} file */
  const syntax = (code, file) => {
    try {
      new vm.Script(code, { filename: file });
    } catch (e) {
      fail(file, `<script> の文法エラー: ${e.message}`);
    }
  };
  for (const [, attrs, code] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/type\s*=\s*["']?(module|importmap)/i.test(attrs)) continue;
    const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1];
    if (src === undefined) {
      if (code.trim()) syntax(code, entry);
    } else if (!/^(https?:)?\/\//i.test(src)) {
      const file = join(dirname(entry), src);
      if (existsSync(file)) syntax(readFileSync(file, "utf8"), file);
      else fail(entry, `読み込む script が見つかりません: ${src}`);
    }
  }
  for (const [, href] of html.matchAll(/<link[^>]*rel\s*=\s*["']stylesheet["'][^>]*href\s*=\s*["']([^"']+)["']/gi)) {
    if (!/^(https?:)?\/\//i.test(href) && !existsSync(join(dirname(entry), href)))
      fail(entry, `読み込む css が見つかりません: ${href}`);
  }
}

/**
 * 組み込み(ランチャーの画面の中で動く)ウィジェットの、部品の登録(`index.tsx`)が、そろっているか調べる。
 * @param {string} dir ウィジェットのフォルダ
 * @param {string} mf マニフェストのパス
 * @param {string} kind `builtin` の名前
 */
function checkBuiltin(dir, mf, kind) {
  // 持ち主は、ウィジェットのフォルダ自身(src/widgets/<id>)か、ミニアプリのフォルダ(src/miniapps/<id>/widgets/<名前> の 2 つ上)
  const inMiniapp = basename(dirname(dir)) === "widgets" && basename(dirname(dirname(dir))) !== "src";
  const base = inMiniapp ? dirname(dirname(dir)) : dir;
  const index = ["index.tsx", "index.ts"].map((f) => join(base, f)).find((f) => existsSync(f));
  if (!index) return fail(mf, `builtin "${kind}" の部品を登録する index.tsx が、${relative(ROOT, base)} にありません`);
  if (!new RegExp(`\\b${kind}\\s*:`).test(readFileSync(index, "utf8")))
    fail(index, `widgets に "${kind}" が登録されていません`);
}

const dirs = [
  ...findDirs(join(ROOT, "miniapps"), "miniapp.json").map((d) => [d, "miniapp.json"]),
  ...findDirs(join(ROOT, "widgets"), "widget.json").map((d) => [d, "widget.json"]),
  ...findDirs(join(ROOT, "miniapps"), "widget.json").map((d) => [d, "widget.json"]),
];
for (const [d, m] of dirs) check(d, m);

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`ミニアプリ・ウィジェット ${dirs.length} 件: OK`);
