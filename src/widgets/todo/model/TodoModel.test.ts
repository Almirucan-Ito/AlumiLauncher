import { describe, expect, it } from "vitest";
import { parseList, ymdOf } from "./TodoModel";

describe("parseList", () => {
  it("配列だけを返す(無い・壊れている・配列でないときは空)", () => {
    expect(parseList<number>(undefined)).toEqual([]);
    expect(parseList<number>("{")).toEqual([]);
    expect(parseList<number>('{"a":1}')).toEqual([]);
    expect(parseList<number>("[1,2]")).toEqual([1, 2]);
  });
});

describe("ymdOf", () => {
  it("ローカル時刻の YYYY-MM-DD", () => {
    expect(ymdOf(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(ymdOf(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});
