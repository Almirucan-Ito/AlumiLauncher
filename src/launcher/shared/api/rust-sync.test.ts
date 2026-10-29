import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HOME_ORDER_KEY } from "../../modules/home/HomeModel";
import { DEFAULT_SETTINGS } from "./ApiModel";

/** Rust 側のソースを読む(画面側と、同じにしておくべき値が、ずれていないかを確かめるため)。 */
const rust = (file: string) => readFileSync(join(process.cwd(), "src-tauri", "src", file), "utf8");

describe("画面(TypeScript)と本体(Rust)で、同じにしておく値", () => {
  it("ホームの並び順のキー(HOME_ORDER_KEY)", () => {
    const m = /const HOME_ORDER_KEY: &str = "([^"]+)";/.exec(rust("files/listing.rs"));
    expect(m?.[1]).toBe(HOME_ORDER_KEY);
  });

  it("設定の項目の名前(Settings の、JSON での名前と、DEFAULT_SETTINGS のキー)", () => {
    const src = rust("config/model.rs");
    const body = /pub\(crate\) struct Settings \{([\s\S]*?)\n\}/.exec(src)?.[1] ?? "";
    const keys: string[] = [];
    let renamed: string | null = null;
    for (const line of body.split("\n")) {
      const r = /#\[serde\(rename = "([^"]+)"\)\]/.exec(line);
      if (r) renamed = r[1];
      const f = /^\s*pub\(crate\) ([a-z_0-9]+):/.exec(line);
      if (f) {
        keys.push(renamed ?? f[1]);
        renamed = null;
      }
    }
    expect(keys.length).toBeGreaterThan(20);
    expect(keys.filter((k) => k.includes("_"))).toEqual([]); // 名前の変換(rename)の書き忘れがない
    expect([...keys].sort()).toEqual(Object.keys(DEFAULT_SETTINGS).sort());
  });
});
