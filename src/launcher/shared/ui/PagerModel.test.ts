import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CENTER_ZONE,
  EDGE_FLIP_MS,
  EDGE_PX,
  RIM_ZONE,
  chunk,
  computeGrid,
  edgeDirectionOf,
  hoverZoneOf,
  makeEdgeFlipper,
  reorderedItems,
  swipePageDelta,
  withResistance,
  type PagerApi,
} from "./PagerModel";

describe("chunk", () => {
  it("n 個ずつのページに分ける", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it("空のときも、空のページが 1 つ", () => {
    expect(chunk([], 4)).toEqual([[]]);
  });
});

describe("computeGrid", () => {
  const layout = { mode: "auto" as const, count: 9, size: 80, gap: 10 };
  it("固定: 個数から、正方形に近い形にする", () => {
    expect(computeGrid({ ...layout, mode: "fixed", count: 9 }, 0, 0)).toEqual({ cols: 3, rows: 3, perPage: 9 });
    expect(computeGrid({ ...layout, mode: "fixed", count: 6 }, 0, 0)).toEqual({ cols: 3, rows: 2, perPage: 6 });
    expect(computeGrid({ ...layout, mode: "fixed", count: 0 }, 0, 0)).toEqual({ cols: 1, rows: 1, perPage: 1 });
  });
  it("自動: 測る前(幅か高さが 0)は 3x3", () => {
    expect(computeGrid(layout, 0, 500)).toEqual({ cols: 3, rows: 3, perPage: 9 });
  });
  it("自動: アイコンの大きさと間隔から、収まる数を求める", () => {
    // 1 マスの幅 = 80 * 1.45 = 116。(600 + 10) / (116 + 10) = 4.84… → 4 列
    // 1 マスの高さ = 80 * 1.35 + 32 = 140。(400 + 10) / (140 + 10) = 2.73… → 2 行
    expect(computeGrid(layout, 600, 400)).toEqual({ cols: 4, rows: 2, perPage: 8 });
  });
  it("自動: 小さすぎても、1x1 は確保する", () => {
    expect(computeGrid(layout, 10, 10)).toEqual({ cols: 1, rows: 1, perPage: 1 });
  });
  it("compact(ラベル無し)は、行が詰まる", () => {
    const normal = computeGrid(layout, 600, 400);
    const compact = computeGrid({ ...layout, compact: true }, 600, 400);
    expect(compact.cols).toBe(normal.cols);
    expect(compact.rows).toBeGreaterThan(normal.rows);
  });
});

describe("hoverZoneOf", () => {
  it("中央で、重ねられるなら、center", () => {
    expect(hoverZoneOf(0.5, 0.5, CENTER_ZONE, true)).toBe("center");
  });
  it("中央でも、重ねられないなら、入れ替え(inner)", () => {
    expect(hoverZoneOf(0.5, 0.5, CENTER_ZONE, false)).toBe("inner");
  });
  it("縁(境目に近い所)は、何もしない(rim)", () => {
    expect(hoverZoneOf(RIM_ZONE / 2, 0.5, CENTER_ZONE, true)).toBe("rim");
    expect(hoverZoneOf(0.5, 1 - RIM_ZONE / 2, CENTER_ZONE, false)).toBe("rim");
  });
  it("中央の広さを変えると、判定が変わる", () => {
    expect(hoverZoneOf(0.7, 0.5, 0.1, true)).toBe("inner");
    expect(hoverZoneOf(0.7, 0.5, 0.3, true)).toBe("center");
  });
});

describe("reorderedItems", () => {
  const id = (s: string) => s;
  it("ドラッグしているものを、相手の位置へ入れる(後ろへ)", () => {
    expect(reorderedItems(["a", "b", "c", "d"], id, "a", "c")).toEqual(["b", "c", "a", "d"]);
  });
  it("前へも入れられる", () => {
    expect(reorderedItems(["a", "b", "c", "d"], id, "d", "b")).toEqual(["a", "d", "b", "c"]);
  });
  it("元の配列は変えない", () => {
    const src = ["a", "b", "c"];
    reorderedItems(src, id, "a", "c");
    expect(src).toEqual(["a", "b", "c"]);
  });
  it("同じもの・存在しないものは、null", () => {
    expect(reorderedItems(["a", "b"], id, "a", "a")).toBeNull();
    expect(reorderedItems(["a", "b"], id, "a", "x")).toBeNull();
    expect(reorderedItems(["a", "b"], id, "x", "b")).toBeNull();
  });
});

describe("edgeDirectionOf", () => {
  const rect = { left: 100, right: 500, top: 50, bottom: 350 };
  const band = { left: 80, right: 520, top: 50, bottom: 350 };
  it("左端に寄せると -1、右端に寄せると 1", () => {
    expect(edgeDirectionOf(100 + EDGE_PX - 1, 200, rect, band, false)).toBe(-1);
    expect(edgeDirectionOf(500 - EDGE_PX + 1, 200, rect, band, false)).toBe(1);
  });
  it("中ほどは 0", () => {
    expect(edgeDirectionOf(300, 200, rect, band, false)).toBe(0);
  });
  it("枠の外へ出しているときは 0", () => {
    expect(edgeDirectionOf(100 + EDGE_PX - 1, 400, rect, band, false)).toBe(0);
    expect(edgeDirectionOf(10, 200, rect, band, false)).toBe(0);
  });
  it("Shift を押している間(frozen)は 0", () => {
    expect(edgeDirectionOf(100 + EDGE_PX - 1, 200, rect, band, true)).toBe(0);
  });
});

describe("swipePageDelta / withResistance", () => {
  it("左へ 60px より大きく動かすと次、右へなら前、それ以下は送らない", () => {
    expect(swipePageDelta(-61)).toBe(1);
    expect(swipePageDelta(61)).toBe(-1);
    expect(swipePageDelta(-60)).toBe(0);
    expect(swipePageDelta(60)).toBe(0);
    expect(swipePageDelta(0)).toBe(0);
  });
  it("最初のページで右へ・最後のページで左へ引くと、抵抗が付く(0.3 倍)", () => {
    expect(withResistance(100, 0, 3)).toBeCloseTo(30);
    expect(withResistance(-100, 2, 3)).toBeCloseTo(-30);
  });
  it("それ以外は、そのまま", () => {
    expect(withResistance(-100, 0, 3)).toBe(-100);
    expect(withResistance(100, 2, 3)).toBe(100);
    expect(withResistance(100, 1, 3)).toBe(100);
    expect(withResistance(-100, 1, 3)).toBe(-100);
  });
});

describe("makeEdgeFlipper", () => {
  const rect = { left: 100, right: 500, top: 50, bottom: 350 } as DOMRect;
  let go: ReturnType<typeof vi.fn<(d: number) => void>>;
  let api: PagerApi;

  beforeEach(() => {
    vi.useFakeTimers();
    go = vi.fn();
    api = { go, rect: () => rect };
  });
  afterEach(() => vi.useRealTimers());

  it("左の端に居続けると、待ったあと、前のページへ送り、その後も続ける", () => {
    const f = makeEdgeFlipper(() => api);
    f.feed(110, 200, true);
    expect(go).not.toHaveBeenCalled();
    vi.advanceTimersByTime(EDGE_FLIP_MS);
    expect(go).toHaveBeenCalledWith(-1);
    vi.advanceTimersByTime(EDGE_FLIP_MS + 150);
    expect(go).toHaveBeenCalledTimes(2);
    f.stop();
  });

  it("右の端なら、次のページへ", () => {
    const f = makeEdgeFlipper(() => api);
    f.feed(490, 200, true);
    vi.advanceTimersByTime(EDGE_FLIP_MS);
    expect(go).toHaveBeenCalledWith(1);
    f.stop();
  });

  it("端から離れる・ドラッグが終わる(active=false)と、止まる", () => {
    const f = makeEdgeFlipper(() => api);
    f.feed(110, 200, true);
    f.feed(300, 200, true);
    vi.advanceTimersByTime(EDGE_FLIP_MS * 3);
    expect(go).not.toHaveBeenCalled();
    f.feed(110, 200, true);
    f.feed(110, 200, false);
    vi.advanceTimersByTime(EDGE_FLIP_MS * 3);
    expect(go).not.toHaveBeenCalled();
  });

  it("一覧の上下の外にいるときは、送らない", () => {
    const f = makeEdgeFlipper(() => api);
    f.feed(110, 400, true);
    vi.advanceTimersByTime(EDGE_FLIP_MS * 3);
    expect(go).not.toHaveBeenCalled();
  });

  it("送り先が無いときも、壊れない", () => {
    const f = makeEdgeFlipper(() => null);
    expect(() => f.feed(110, 200, true)).not.toThrow();
  });
});
