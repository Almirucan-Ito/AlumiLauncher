// 依存ライブラリのライセンス表示(THIRD_PARTY_LICENSES.md)を作る(`npm run licenses`)。
// 配布する exe に入る、実行時の依存だけを対象にする。
//   - Rust: Cargo.lock の、Windows 向けの通常の依存(ビルド用・テスト用は除く)
//   - 画面: package.json の dependencies と、その推移的な依存(開発用は除く)
// 各ライブラリのライセンス文は、ダウンロード済みのソース(~/.cargo/registry・node_modules)から読む。同じ文面は、まとめて 1 回だけ載せる。
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const TARGET = "x86_64-pc-windows-msvc";
const LICENSE_FILE = /^(licen[cs]e|copying|notice|unlicense)([-_.].*)?$/i;

/** @type {{ kind: string; name: string; version: string; license: string; repo: string; texts: string[] }[]} */
const libs = [];

/** ライセンスの文面のファイルを読む。 */
function readTexts(dir) {
  if (!dir || !existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && LICENSE_FILE.test(e.name))
    .map((e) => readFileSync(join(dir, e.name), "utf8").replace(/\r\n/g, "\n").trim())
    .filter(Boolean);
}

// ---- Rust ----
const meta = JSON.parse(
  spawnSync(
    "cargo",
    [
      "metadata",
      "--format-version",
      "1",
      "--filter-platform",
      TARGET,
      "--manifest-path",
      join(root, "src-tauri/Cargo.toml"),
    ],
    {
      encoding: "utf8",
      maxBuffer: 1 << 28,
    },
  ).stdout,
);
const byId = new Map(meta.packages.map((p) => [p.id, p]));
const nodes = new Map(meta.resolve.nodes.map((n) => [n.id, n]));
const seen = new Set();
const walk = (id) => {
  if (seen.has(id)) return;
  seen.add(id);
  for (const d of nodes.get(id)?.deps ?? []) {
    if (d.dep_kinds.some((k) => k.kind === null)) walk(d.pkg);
  }
};
walk(meta.resolve.root);
for (const id of seen) {
  const p = byId.get(id);
  if (!p || id === meta.resolve.root) continue;
  libs.push({
    kind: "Rust",
    name: p.name,
    version: p.version,
    license: p.license ?? "(不明)",
    repo: p.repository ?? "",
    texts: readTexts(dirname(p.manifest_path)),
  });
}

// ---- 画面(npm) ----
const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
for (const [path, info] of Object.entries(lock.packages)) {
  if (!path || info.dev || info.optional) continue;
  const name = path.replace(/^.*node_modules\//, "");
  const dir = join(root, path);
  let repo = "";
  try {
    const pj = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    repo = typeof pj.repository === "string" ? pj.repository : (pj.repository?.url ?? "");
  } catch {
    /* package.json が読めなくても、続ける */
  }
  libs.push({
    kind: "npm",
    name,
    version: info.version,
    license: info.license ?? "(不明)",
    repo,
    texts: readTexts(dir),
  });
}

// ---- 出力 ----
libs.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
const groups = new Map();
const missing = [];
for (const l of libs) {
  if (!l.texts.length) missing.push(l);
  for (const t of l.texts) {
    if (!groups.has(t)) groups.set(t, []);
    groups.get(t).push(l);
  }
}
let out = `# 第三者のライセンス(Third-party licenses)

AlumiLauncher は、次のライブラリを含みます。それぞれのライセンスに従います。
このファイルは \`npm run licenses\` で作ります(手で書き換えないでください)。

AlumiLauncher uses the following libraries. Each is licensed under its own terms.

## ライブラリの一覧(${libs.length} 件)

| 種類 | 名前 | バージョン | ライセンス |
| --- | --- | --- | --- |
${libs.map((l) => `| ${l.kind} | ${l.name} | ${l.version} | ${l.license.replace(/\|/g, "/")} |`).join("\n")}
`;
if (missing.length) {
  out += `\n## ライセンス文のファイルが見つからなかったもの\n\nライセンスの種類(上の表)と、配布元を参照してください。\n\n${missing
    .map((l) => `- ${l.name} ${l.version} (${l.license})${l.repo ? ` — ${l.repo}` : ""}`)
    .join("\n")}\n`;
}
out += "\n## ライセンスの全文\n";
let n = 0;
for (const [text, users] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
  n++;
  out += `\n### ${n}. ${[...new Set(users.map((u) => u.license))].join(" / ")}\n\n対象: ${users.map((u) => `${u.name} ${u.version}`).join(", ")}\n\n\`\`\`text\n${text}\n\`\`\`\n`;
}
writeFileSync(join(root, "THIRD_PARTY_LICENSES.md"), out);
console.log(`THIRD_PARTY_LICENSES.md: ${libs.length} 件(文面なし ${missing.length} 件、文面の種類 ${groups.size})`);
