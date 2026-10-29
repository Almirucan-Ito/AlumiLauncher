import { describe, expect, it } from "vitest";
import { applyOrder } from "./FolderModel";

const item = (path: string) => ({ name: path, path });

describe("applyOrder", () => {
  const items = ["a", "b", "c", "d"].map(item);
  it("並び順がなければ、そのまま", () => {
    expect(applyOrder(items, undefined)).toBe(items);
    expect(applyOrder(items, [])).toBe(items);
  });
  it("保存した順に並べ、載っていないものは、元の順のまま後ろへ", () => {
    expect(applyOrder(items, ["c", "a"]).map((i) => i.path)).toEqual(["c", "a", "b", "d"]);
  });
  it("一覧にない並び順の項目は、無視する", () => {
    expect(applyOrder(items, ["zzz", "d"]).map((i) => i.path)).toEqual(["d", "a", "b", "c"]);
  });
  it("元の配列は、変えない", () => {
    const before = items.map((i) => i.path);
    applyOrder(items, ["d", "c"]);
    expect(items.map((i) => i.path)).toEqual(before);
  });
});
