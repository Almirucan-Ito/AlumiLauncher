import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), "utf8");

/** スキーマ(権限の名前の元)に書かれた権限。 */
const schemaPermissions: string[] = JSON.parse(read("schemas", "miniapp.schema.json")).properties.permissions.items
  .enum;

/** 権限を実装している場所(ランチャーの窓口と、各ミニアプリが持ち込む窓口)の、ソース。 */
function implementationSource(): string {
  let src = read("src", "launcher", "modules", "miniapps", "miniapp.tsx");
  const dir = join(root, "src", "miniapps");
  for (const id of readdirSync(dir, { withFileTypes: true })) {
    if (!id.isDirectory() || id.name.startsWith("_")) continue;
    for (const sub of ["controller", "view"]) {
      try {
        for (const f of readdirSync(join(dir, id.name, sub))) {
          if (/\.tsx?$/.test(f)) src += read("src", "miniapps", id.name, sub, f);
        }
      } catch {
        /* そのフォルダは無い */
      }
    }
  }
  return src;
}

describe("ミニアプリの権限", () => {
  it("スキーマに書かれた権限は、すべて、ランチャーのどこかで実装されている(書き忘れの確認)", () => {
    const src = implementationSource();
    for (const p of schemaPermissions) {
      const handled =
        src.includes(`allowed("${p}")`) || src.includes(`permission: "${p}"`) || src.includes(`includes("${p}")`);
      expect(handled, `権限 "${p}" を処理するコードが見つかりません`).toBe(true);
    }
  });

  it("同梱のミニアプリが宣言している権限は、すべてスキーマにある", () => {
    const dir = join(root, "src", "miniapps");
    for (const id of readdirSync(dir, { withFileTypes: true })) {
      if (!id.isDirectory() || id.name.startsWith("_")) continue;
      const m = JSON.parse(read("src", "miniapps", id.name, "miniapp.json"));
      for (const p of m.permissions ?? []) expect(schemaPermissions, `${id.name} の権限 ${p}`).toContain(p);
    }
  });
});
