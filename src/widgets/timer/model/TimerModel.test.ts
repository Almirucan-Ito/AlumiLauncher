import { describe, expect, it } from "vitest";
import { TIMER_MODES, parseTimer } from "./TimerModel";

describe("parseTimer", () => {
  const fallback = { total: 25 * 60, endAt: null, left: 25 * 60 };
  it("保存がないとき・壊れているときは、集中 25 分の待機状態", () => {
    expect(parseTimer(undefined)).toEqual(fallback);
    expect(parseTimer("")).toEqual(fallback);
    expect(parseTimer("{")).toEqual(fallback);
    expect(parseTimer("null")).toEqual(fallback);
    expect(parseTimer('{"total":"x","endAt":null,"left":1}')).toEqual(fallback);
  });
  it("正しい保存は、そのまま読む", () => {
    expect(parseTimer('{"total":300,"endAt":null,"left":120}')).toEqual({ total: 300, endAt: null, left: 120 });
    expect(parseTimer('{"total":300,"endAt":1700000000000,"left":300}')).toEqual({
      total: 300,
      endAt: 1700000000000,
      left: 300,
    });
  });
});

describe("TIMER_MODES", () => {
  it("集中 25・休憩 5・長休憩 15", () => {
    expect(TIMER_MODES.map((m) => m.min)).toEqual([25, 5, 15]);
  });
});
