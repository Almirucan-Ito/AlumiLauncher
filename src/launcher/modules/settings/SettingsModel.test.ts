import { describe, expect, it } from "vitest";
import { keyName, normalizeHex, validHotkey } from "./SettingsModel";

describe("normalizeHex(キーボードで打った色のコード)", () => {
  it("6 桁は、# があってもなくても、小文字の #rrggbb にそろえる", () => {
    expect(normalizeHex("#3b82f6")).toBe("#3b82f6");
    expect(normalizeHex("3B82F6")).toBe("#3b82f6");
    expect(normalizeHex("#FFAA00")).toBe("#ffaa00");
  });
  it("3 桁は、6 桁に広げる", () => {
    expect(normalizeHex("#f80")).toBe("#ff8800");
    expect(normalizeHex("ABC")).toBe("#aabbcc");
  });
  it("前後の空白は、気にしない", () => {
    expect(normalizeHex("  #3b82f6 ")).toBe("#3b82f6");
  });
  it("色として読めないものは null(桁の数・文字・空・色の名前)", () => {
    for (const bad of ["", "#", "#12", "#1234", "#12345", "#1234567", "#gggggg", "red", "#12 456", "##123456"])
      expect(normalizeHex(bad)).toBeNull();
  });
});

describe("keyName", () => {
  it("修飾キー・英数字・F キー・記号を、ショートカットの名前にする", () => {
    expect(keyName("ControlLeft")).toBe("Ctrl");
    expect(keyName("AltRight")).toBe("Alt");
    expect(keyName("ShiftLeft")).toBe("Shift");
    expect(keyName("MetaLeft")).toBe("Win");
    expect(keyName("KeyL")).toBe("L");
    expect(keyName("Digit5")).toBe("5");
    expect(keyName("F5")).toBe("F5");
    expect(keyName("Space")).toBe("Space");
  });
  it("使えないキーは null", () => {
    expect(keyName("F13")).toBeNull();
    expect(keyName("ArrowLeft")).toBeNull();
    expect(keyName("CapsLock")).toBeNull();
  });
});

describe("validHotkey(Rust 側の parse_hotkey と同じ決まり)", () => {
  it("先頭が修飾キーで、全体が 2〜3 キーなら使える", () => {
    expect(validHotkey(["Ctrl", "L"])).toBe(true);
    expect(validHotkey(["Ctrl", "Alt", "L"])).toBe(true);
    expect(validHotkey(["Alt", "Space", "L"])).toBe(true);
  });
  it("1 キー・4 キー・修飾キーだけ・重複は使えない", () => {
    expect(validHotkey(["L"])).toBe(false);
    expect(validHotkey(["Ctrl", "Alt", "Shift", "L"])).toBe(false);
    expect(validHotkey(["Ctrl", "Alt"])).toBe(false);
    expect(validHotkey(["Ctrl", "L", "L"])).toBe(false);
  });
  it("先頭が修飾キーでなければ使えない", () => {
    expect(validHotkey(["L", "Ctrl"])).toBe(false);
  });
});
