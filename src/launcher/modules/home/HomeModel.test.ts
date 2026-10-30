import { describe, expect, it } from "vitest";
import { clampSlot, entryKey, folderUnderPoint, insertClamped } from "./HomeModel";

describe("entryKey", () => {
  it("フォルダは f:<ID>、ショートカットは i:<パス>、空きは slot", () => {
    expect(entryKey({ kind: "folder", folder: { id: "x1", name: "N", path: "C:\\p" } })).toBe("f:x1");
    expect(entryKey({ kind: "item", item: { name: "a.lnk", path: "C:\\a.lnk" } })).toBe("i:C:\\a.lnk");
    expect(entryKey({ kind: "slot" })).toBe("slot");
  });
});

describe("insertClamped", () => {
  it("指定の位置に入れる", () => {
    expect(insertClamped(["a", "b", "c"], 1, "x")).toEqual(["a", "x", "b", "c"]);
    expect(insertClamped(["a", "b"], 0, "x")).toEqual(["x", "a", "b"]);
  });
  it("後ろを超える位置・null は、一番後ろ", () => {
    expect(insertClamped(["a", "b"], 9, "x")).toEqual(["a", "b", "x"]);
    expect(insertClamped(["a", "b"], null, "x")).toEqual(["a", "b", "x"]);
  });
  it("負の位置は、先頭。元の配列は変えない", () => {
    const src = ["a", "b"];
    expect(insertClamped(src, -3, "x")).toEqual(["x", "a", "b"]);
    expect(src).toEqual(["a", "b"]);
  });
  it("空の並びにも入れられる", () => {
    expect(insertClamped([], null, "x")).toEqual(["x"]);
  });
});

describe("clampSlot", () => {
  it("マスの外(null / undefined)は、一番後ろ", () => {
    expect(clampSlot(null, 5)).toBe(5);
    expect(clampSlot(undefined, 5)).toBe(5);
  });
  it("項目の数を超えない", () => {
    expect(clampSlot(3, 5)).toBe(3);
    expect(clampSlot(5, 5)).toBe(5);
    expect(clampSlot(9, 5)).toBe(5);
    expect(clampSlot(0, 0)).toBe(0);
  });
});

describe("folderUnderPoint", () => {
  const folders = [
    { id: "a", left: 0, top: 0, width: 100, height: 100 },
    { id: "b", left: 200, top: 0, width: 100, height: 100 },
  ];
  it("中央に乗っているフォルダを返す", () => {
    expect(folderUnderPoint(folders, 50, 50, 0.3)?.id).toBe("a");
    expect(folderUnderPoint(folders, 250, 60, 0.3)?.id).toBe("b");
  });
  it("中央から外れていたら、null(広さの割合で決まる)", () => {
    expect(folderUnderPoint(folders, 90, 50, 0.3)).toBeNull();
    expect(folderUnderPoint(folders, 90, 50, 0.5)?.id).toBe("a");
  });
  it("除くフォルダ(開いているもの)は、乗っていても返さない", () => {
    expect(folderUnderPoint(folders, 50, 50, 0.3, "a")).toBeNull();
    expect(folderUnderPoint(folders, 250, 50, 0.3, "a")?.id).toBe("b");
  });
  it("フォルダが無ければ、null", () => {
    expect(folderUnderPoint([], 10, 10, 0.3)).toBeNull();
  });
});
