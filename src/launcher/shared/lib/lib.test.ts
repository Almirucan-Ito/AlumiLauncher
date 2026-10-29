import { describe, expect, it } from "vitest";
import { isLight } from "./ColorUtil";
import { fmtTime, pad2 } from "./FormatUtil";
import { newId } from "./IdUtil";
import { clamp, clamp01 } from "./MathUtil";
import { defineMessages, formatMessage } from "./MessageUtil";

describe("MathUtil", () => {
  it("clamp は、範囲に収める", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });
  it("clamp01 は、0〜1 に収める", () => {
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(7)).toBe(1);
  });
});

describe("FormatUtil", () => {
  it("pad2 は、2 桁にそろえる", () => {
    expect(pad2(7)).toBe("07");
    expect(pad2(12)).toBe("12");
    expect(pad2(0)).toBe("00");
  });
  it("fmtTime は、分:秒にする(負の値は 0)", () => {
    expect(fmtTime(187)).toBe("3:07");
    expect(fmtTime(0)).toBe("0:00");
    expect(fmtTime(-5)).toBe("0:00");
    expect(fmtTime(59.9)).toBe("0:59");
    expect(fmtTime(3600)).toBe("60:00");
  });
});

describe("MessageUtil", () => {
  it("formatMessage は、{名前} を置き換える", () => {
    expect(formatMessage("{n} 個", { n: 3 })).toBe("3 個");
    expect(formatMessage("{a}-{b}", { a: "x", b: 2 })).toBe("x-2");
    expect(formatMessage("そのまま")).toBe("そのまま");
  });
  it("defineMessages は、表示言語の文言を返す(テストの環境は英語)", () => {
    const t = defineMessages({ hello: "こんにちは {name}" }, { hello: "Hello {name}" });
    expect(t("hello", { name: "A" })).toBe("Hello A");
  });
});

describe("IdUtil", () => {
  it("newId は、毎回ちがう文字列を返す", () => {
    const ids = new Set(Array.from({ length: 50 }, () => newId()));
    expect(ids.size).toBe(50);
  });
});

describe("ColorUtil", () => {
  it("isLight は、明るい色だけ true", () => {
    expect(isLight("#ffffff")).toBe(true);
    expect(isLight("#000000")).toBe(false);
    expect(isLight("3b82f6")).toBe(false);
    expect(isLight("#fff")).toBe(false); // 形式が違えば false
    expect(isLight("かきくけこ")).toBe(false);
  });
});
