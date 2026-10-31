import { describe, expect, it } from "vitest";
import { isMiniShortcut } from "../../../launcher/shared/lib/PathUtil";
import {
  MAX_SHORTCUTS,
  addShortcut,
  iconLayout,
  moveShortcut,
  pruneShortcuts,
  entryFromDrop,
  parseShortcuts,
  removeShortcut,
  shortcutKey,
  slotIndex,
  type ShortcutEntry,
} from "./ShortcutsModel";

const item = (n: number): ShortcutEntry => ({ kind: "item", path: `C:\\h\\${n}.lnk`, name: `${n}.lnk` });
const folder: ShortcutEntry = { kind: "folder", id: "f1", path: "C:\\folders\\f1", name: "仕事" };

describe("parseShortcuts", () => {
  it("保存した一覧を読み戻せる", () => {
    expect(parseShortcuts(JSON.stringify([item(1), folder]))).toEqual([item(1), folder]);
  });
  it("無い・壊れている・配列でないときは空", () => {
    expect(parseShortcuts(undefined)).toEqual([]);
    expect(parseShortcuts("{")).toEqual([]);
    expect(parseShortcuts('{"a":1}')).toEqual([]);
  });
  it("形が正しくないものは捨てる", () => {
    const raw = JSON.stringify([
      item(1),
      { kind: "item", path: 1 },
      { kind: "folder", path: "p", name: "n" },
      null,
      "x",
    ]);
    expect(parseShortcuts(raw)).toEqual([item(1)]);
  });
  it("上限を超えたぶんは捨てる", () => {
    const many = Array.from({ length: MAX_SHORTCUTS + 5 }, (_, i) => item(i));
    expect(parseShortcuts(JSON.stringify(many))).toHaveLength(MAX_SHORTCUTS);
  });
});

describe("addShortcut / removeShortcut", () => {
  it("最後に足す", () => {
    expect(addShortcut([item(1)], item(2)).list).toEqual([item(1), item(2)]);
  });
  it("同じものは足さない(アイコンはパス、フォルダは ID で見分ける)", () => {
    expect(addShortcut([item(1)], item(1))).toEqual({ list: [item(1)], reason: "exists" });
    expect(addShortcut([folder], { ...folder, name: "名前を変えた" }).reason).toBe("exists");
  });
  it("上限までしか足さない", () => {
    const full = Array.from({ length: MAX_SHORTCUTS }, (_, i) => item(i));
    expect(addShortcut(full, item(999)).reason).toBe("full");
  });
  it("識別子で外す", () => {
    expect(removeShortcut([item(1), folder], shortcutKey(folder))).toEqual([item(1)]);
  });
});

describe("置ける数と並べ方", () => {
  it("上限は、1 段 6 個 × 2 段", () => {
    expect(MAX_SHORTCUTS).toBe(12);
  });
  it("置ける数を渡すと、そこまでしか足さない", () => {
    const six = Array.from({ length: 6 }, (_, i) => item(i));
    expect(addShortcut(six, item(99), 6).reason).toBe("full");
    expect(addShortcut(six, item(99), 12).list).toHaveLength(7);
  });
  it("小(高さ 1 マス): 1 段で、マスと同じ大きさ。6 個まで", () => {
    expect(iconLayout(332, 44, 44)).toEqual({ rows: 1, side: 44, capacity: 6 });
    expect(iconLayout(100, 44, 44)).toEqual({ rows: 1, side: 44, capacity: 6 });
  });
  it("標準(高さ 2 マス): 1 段で、横 6 個が収まる幅に合わせて大きくする(マスより小さくしない)", () => {
    expect(iconLayout(332, 92, 44)).toEqual({ rows: 1, side: 52, capacity: 6 });
    expect(iconLayout(236, 92, 44)).toEqual({ rows: 1, side: 44, capacity: 6 });
  });
  it("大(高さ 3 マス): 2 段で、12 個まで。高さに収まる大きさまで", () => {
    expect(iconLayout(332, 140, 44)).toEqual({ rows: 2, side: 52, capacity: 12 });
    expect(iconLayout(332, 140, 30).side).toBeLessThanOrEqual(68);
  });
});

describe("pruneShortcuts: 参照先が無くなったものを外す", () => {
  const mini: ShortcutEntry = { kind: "mini", id: "memo", name: "メモ" };
  const home = (...e: ShortcutEntry[]) => new Set(e.map(shortcutKey));
  it("ホームに無いアイコン・フォルダは、外す", () => {
    expect(pruneShortcuts([item(1), item(2), folder], home(item(2)), null)).toEqual([item(2)]);
    expect(pruneShortcuts([item(1), folder], home(item(1)), null)).toEqual([item(1)]);
  });
  it("ミニアプリは、ホームではなく、ミニアプリのフォルダにあるかで決める", () => {
    expect(pruneShortcuts([mini], home(), new Set(["memo"]))).toEqual([mini]);
    expect(pruneShortcuts([mini], home(mini), new Set(["music"]))).toEqual([]);
  });
  it("まだ読み込めていない(null)ときは、何も外さない", () => {
    const l = [item(1), folder, mini];
    expect(pruneShortcuts(l, null, null)).toBe(l);
    expect(pruneShortcuts(l, home(item(1), folder), null)).toBe(l);
    expect(pruneShortcuts(l, null, new Set(["memo"]))).toBe(l);
  });
  it("外すものが無ければ、元の一覧そのもの", () => {
    const l = [item(1)];
    expect(pruneShortcuts(l, home(item(1)), new Set())).toBe(l);
  });
  it("ミニアプリの項目を保存・読み込みできる。`.alumiapp` を見分ける", () => {
    expect(parseShortcuts(JSON.stringify([mini]))).toEqual([mini]);
    expect(parseShortcuts(JSON.stringify([{ kind: "mini", name: "x" }]))).toEqual([]);
    expect(isMiniShortcut("C:\\h\\メモ.alumiapp")).toBe(true);
    expect(isMiniShortcut("C:\\h\\a.lnk")).toBe(false);
  });
});

describe("moveShortcut", () => {
  const a = item(1);
  const b = item(2);
  const c = item(3);
  it("前へ・後ろへ動かす", () => {
    expect(moveShortcut([a, b, c], 2, 0)).toEqual([c, a, b]);
    expect(moveShortcut([a, b, c], 0, 2)).toEqual([b, c, a]);
  });
  it("範囲外・同じ位置は、元のまま", () => {
    const l = [a, b, c];
    expect(moveShortcut(l, 1, 1)).toBe(l);
    expect(moveShortcut(l, -1, 1)).toBe(l);
    expect(moveShortcut(l, 0, 3)).toBe(l);
  });
});

describe("slotIndex: 落とす位置の番号", () => {
  // 幅 400 の入れ物に、1 辺 44 のアイコンが 3 つ(44*3 + 4*2 = 140 → 左の余白 130)
  const box = { left: 100, top: 0, width: 400 };
  const at = (x: number, count = 3) => slotIndex(x, 20, box, 44, 1, count);
  it("真ん中に寄っていても、アイコンの真上の番号になる(右から左へも動かせる)", () => {
    expect(at(100 + 130 + 10)).toBe(0);
    expect(at(100 + 130 + 48 + 10)).toBe(1);
    expect(at(100 + 130 + 96 + 10)).toBe(2);
  });
  it("端の外は、いちばん近い端", () => {
    expect(at(0)).toBe(0);
    expect(at(10000)).toBe(2);
  });
  it("はみ出して左詰めのとき(余白 0)は、左端から数える", () => {
    const wide = { left: 0, top: 0, width: 200 };
    expect(slotIndex(48 * 4 + 5, 5, wide, 44, 1, 6)).toBe(4);
  });
  it("2 段のときは、行も見る", () => {
    expect(slotIndex(5, 60, { left: 0, top: 0, width: 288 }, 44, 2, 8)).toBe(6);
  });
  it("1 つもないときは 0", () => {
    expect(at(50, 0)).toBe(0);
  });
});

describe("entryFromDrop", () => {
  it("ドロップの内容から、項目を作る", () => {
    expect(entryFromDrop({ kind: "item", path: "C:\\a.lnk", name: "a.lnk" })).toEqual({
      kind: "item",
      path: "C:\\a.lnk",
      name: "a.lnk",
    });
    expect(entryFromDrop({ kind: "folder", id: "f1", path: "C:\\f", name: "F" })).toEqual({
      kind: "folder",
      id: "f1",
      path: "C:\\f",
      name: "F",
    });
  });
});
