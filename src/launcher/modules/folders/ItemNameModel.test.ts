import { describe, expect, it } from "vitest";
import { HOME_ORDER_KEY } from "../home/HomeModel";
import { checkStem, replacePathInOrders, splitFileName } from "./ItemNameModel";

describe("splitFileName(名前の部分と拡張子)", () => {
  it("最後の . から後ろを、拡張子にする", () => {
    expect(splitFileName("Google Chrome.lnk")).toEqual({ stem: "Google Chrome", ext: ".lnk" });
    expect(splitFileName("a.b.txt")).toEqual({ stem: "a.b", ext: ".txt" });
  });
  it("拡張子が無い・先頭の . だけのものは、拡張子なし", () => {
    expect(splitFileName("README")).toEqual({ stem: "README", ext: "" });
    expect(splitFileName(".gitignore")).toEqual({ stem: ".gitignore", ext: "" });
  });
});

describe("checkStem(入力した名前が使えるか)", () => {
  it("ふつうの名前は使える(日本語・空白・途中の . も)", () => {
    expect(checkStem("新しいテキスト", ".txt")).toBe("ok");
    expect(checkStem("My File", ".lnk")).toBe("ok");
    expect(checkStem("v1.2 メモ", ".txt")).toBe("ok");
  });
  it("空・空白だけは使えない", () => {
    expect(checkStem("", ".txt")).toBe("empty");
    expect(checkStem("   ", ".txt")).toBe("empty");
  });
  it("使えない文字", () => {
    for (const c of ["\\", "/", ":", "*", "?", '"', "<", ">", "|", "\n"])
      expect(checkStem(`a${c}b`, ".txt")).toBe("chars");
  });
  it("前後の空白・終わりの . は使えない", () => {
    expect(checkStem(" a", ".txt")).toBe("edge");
    expect(checkStem("a ", ".txt")).toBe("edge");
    expect(checkStem("a.", ".txt")).toBe("edge");
  });
  it("予約名は使えない(大文字・小文字・拡張子の前の部分で判断)", () => {
    expect(checkStem("con", ".txt")).toBe("reserved");
    expect(checkStem("NUL", "")).toBe("reserved");
    expect(checkStem("Com1", ".lnk")).toBe("reserved");
    expect(checkStem("lpt9.bak", ".txt")).toBe("reserved");
    expect(checkStem("console", ".txt")).toBe("ok");
  });
  it("拡張子を含めて 200 字まで", () => {
    expect(checkStem("あ".repeat(196), ".txt")).toBe("ok");
    expect(checkStem("あ".repeat(197), ".txt")).toBe("long");
  });
  it("拡張子の無いファイルには、. を含む名前を付けられない", () => {
    expect(checkStem("a.exe", "")).toBe("dot");
    expect(checkStem("メモ", "")).toBe("ok");
  });
});

describe("replacePathInOrders(名前を変えたとき、並び順の記録のパスを直す)", () => {
  const orders = {
    [HOME_ORDER_KEY]: ["f:1", "i:C:\\home\\a.txt", "i:C:\\home\\b.txt"],
    folder1: ["C:\\work\\x.txt", "C:\\home\\a.txt"],
  };
  it("ホームの並びは i: 付きのパス、フォルダ内の並びは、パスそのものを置き換える", () => {
    const out = replacePathInOrders(orders, "C:\\home\\a.txt", "C:\\home\\新.txt");
    expect(out[HOME_ORDER_KEY]).toEqual(["f:1", "i:C:\\home\\新.txt", "i:C:\\home\\b.txt"]);
    expect(out.folder1).toEqual(["C:\\work\\x.txt", "C:\\home\\新.txt"]);
  });
  it("パスの大文字・小文字と、/ と \\ の違いは、気にしない", () => {
    const out = replacePathInOrders({ [HOME_ORDER_KEY]: ["i:c:/HOME/A.txt"] }, "C:\\home\\a.txt", "C:\\home\\b.txt");
    expect(out[HOME_ORDER_KEY]).toEqual(["i:C:\\home\\b.txt"]);
  });
  it("元の記録は変えない。記録が無くても、空の記録を返す", () => {
    replacePathInOrders(orders, "C:\\home\\a.txt", "C:\\home\\z.txt");
    expect(orders[HOME_ORDER_KEY][1]).toBe("i:C:\\home\\a.txt");
    expect(replacePathInOrders(undefined, "a", "b")).toEqual({});
  });
  it("ホームの並びで、フォルダの項目(f:)や、別のパスは、そのまま", () => {
    const out = replacePathInOrders({ [HOME_ORDER_KEY]: ["f:C:\\home\\a.txt"] }, "C:\\home\\a.txt", "C:\\home\\b.txt");
    expect(out[HOME_ORDER_KEY]).toEqual(["f:C:\\home\\a.txt"]);
  });
});
