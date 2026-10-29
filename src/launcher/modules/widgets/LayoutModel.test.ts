import { describe, expect, it } from "vitest";
import {
  COLS,
  CELL_SIDE,
  GAP,
  cellSide,
  cellsWith,
  colAtX,
  findSlot,
  placeNear,
  resizeTo,
  resolveLayout,
  ROWS_LARGE,
  ROWS_SMALL,
  ROWS_STANDARD,
  rowsFor,
  rowsToPx,
  type CellRule,
  type Placement,
} from "./LayoutModel";

const rule: CellRule = { min: 1, max: COLS, def: 3 };

describe("findSlot", () => {
  it("空いていれば、その場所", () => {
    expect(findSlot(new Array(COLS).fill(false), 3, 4)).toBe(4);
  });
  it("埋まっていれば、近い空きを探す(同じ距離なら左)", () => {
    const occ = new Array<boolean>(COLS).fill(false);
    occ[4] = occ[5] = occ[6] = true; // 5〜7 マス目が埋まっている
    expect(findSlot(occ, 2, 5)).toBe(3); // 左の 3〜4
  });
  it("置けなければ null", () => {
    expect(findSlot(new Array(COLS).fill(true), 1, 5)).toBeNull();
  });
});

describe("placeNear", () => {
  it("空きに置ける", () => {
    expect(placeNear(new Map(), "a", 1, 3, rule)).toEqual([1, 3]);
  });
  it("入らないときは、幅を縮めて探す", () => {
    const layout = new Map<string, Placement>([["b", [1, 5]]]); // 1〜5 が埋まり、6〜7 だけ空き
    expect(placeNear(layout, "a", 6, 3, rule)).toEqual([6, 2]);
  });
  it("最小の幅でも入らなければ null", () => {
    const layout = new Map<string, Placement>([["b", [1, COLS]]]);
    expect(placeNear(layout, "a", 1, 3, rule)).toBeNull();
  });
  it("動かすウィジェット自身は、場所をふさがない", () => {
    const layout = new Map<string, Placement>([["a", [1, 3]]]);
    expect(placeNear(layout, "a", 1, 3, rule)).toEqual([1, 3]);
  });
});

describe("resizeTo", () => {
  it("範囲外の幅は変えられない", () => {
    expect(resizeTo(new Map(), "a", COLS + 1, rule)).toBeNull();
    expect(resizeTo(new Map(), "a", 0, rule)).toBeNull();
  });
  it("となりが空いていれば広げられ、ふさがれていれば広げられない", () => {
    const layout = new Map<string, Placement>([
      ["a", [1, 3]],
      ["b", [4, 3]],
    ]);
    expect(resizeTo(layout, "a", 3, rule)).toEqual([1, 3]);
    expect(resizeTo(layout, "a", 4, rule)).not.toEqual([1, 4]); // 4 マス目は b が使っている
  });
});

describe("resolveLayout", () => {
  const rules = () => rule;
  it("保存がなければ、最初の 1 つは中央に置く", () => {
    const out = resolveLayout("header", ["a"], {}, rules);
    expect(out.get("a")).toEqual([3, 3]); // 7 マスの中央(3〜5。中心は 4)
  });
  it("保存した場所が正しければ、そのまま使う", () => {
    const out = resolveLayout("header", ["a"], { "header:a": [1, 2] }, rules);
    expect(out.get("a")).toEqual([1, 2]);
  });
  it("保存した場所が重なれば、あとのものは別の空きへ", () => {
    const out = resolveLayout("header", ["a", "b"], { "header:a": [1, 3], "header:b": [2, 3] }, rules);
    expect(out.get("a")).toEqual([1, 3]);
    const b = out.get("b")!;
    expect(b[0] >= 4 || b[0] + b[1] - 1 < 1).toBe(true);
  });
  it("置く場所がなければ、含めない", () => {
    const wide: CellRule = { min: COLS, max: COLS, def: COLS };
    const out = resolveLayout("header", ["a", "b"], {}, () => wide);
    expect([...out.keys()]).toEqual(["a"]);
  });
});

describe("cellsWith", () => {
  it("その欄の古い項目を置き換え、別の欄は残す", () => {
    const base = { "header:a": [1, 1], "footer:x": [2, 2] } as Record<string, Placement>;
    const next = cellsWith("header", base, new Map<string, Placement>([["b", [5, 2]]]));
    expect(next).toEqual({ "footer:x": [2, 2], "header:b": [5, 2] });
  });
});

describe("マス(正方形)の大きさ", () => {
  it("ふだんは固定(広いウィンドウでも、アイコンの大きさの設定でも、変わらない)", () => {
    expect(cellSide(2000)).toBe(CELL_SIDE);
    expect(cellSide(600)).toBe(CELL_SIDE);
    expect(cellSide(COLS * CELL_SIDE + (COLS - 1) * GAP)).toBe(CELL_SIDE);
  });
  it("7 マスが収まらない狭い欄では、収まる大きさまで縮む(すきまを引いて、7 で割る)", () => {
    expect(cellSide(284)).toBe(Math.floor((284 - (COLS - 1) * GAP) / COLS));
  });
  it("とても狭くても、下限(12px)は守る", () => {
    expect(cellSide(50)).toBe(12);
  });
});

describe("高さ(縦のマスの数)", () => {
  it("マスの数から高さ(px)を求める(すきまを含む)", () => {
    expect(rowsToPx(1, 30)).toBe(30);
    expect(rowsToPx(3, 30)).toBe(3 * 30 + 2 * GAP);
  });
  it("選ばなければ標準(2 マス)、小なら 1 マス、大なら 3 マス", () => {
    expect(rowsFor(undefined)).toBe(ROWS_STANDARD);
    expect(rowsFor(ROWS_SMALL)).toBe(ROWS_SMALL);
    expect(rowsFor(ROWS_LARGE)).toBe(ROWS_LARGE);
  });
  it("小・標準・大以外の値は、標準として扱う", () => {
    for (const v of [0, 4, 99, Number.NaN]) expect(rowsFor(v)).toBe(ROWS_STANDARD);
  });
});

describe("colAtX(指の位置から、何マス目か)", () => {
  // 欄の内側: 左 100、幅 400。マス 30px・すきま 4px なら、7 マスの全体は 234px で、中央に寄る
  const [left, width, side] = [100, 400, 30];
  const start = left + (width - (COLS * side + (COLS - 1) * GAP)) / 2;
  it("中央に寄せたマスの、それぞれの真ん中", () => {
    for (let c = 1; c <= COLS; c++)
      expect(colAtX(start + (c - 1) * (side + GAP) + side / 2, left, width, side)).toBe(c);
  });
  it("端の外は、いちばん近いマス", () => {
    expect(colAtX(0, left, width, side)).toBe(1);
    expect(colAtX(9999, left, width, side)).toBe(COLS);
  });
});
