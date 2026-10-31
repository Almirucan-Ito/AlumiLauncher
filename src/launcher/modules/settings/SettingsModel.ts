import { type Theme, type UiTheme } from "../../shared/api/ApiModel";
import { type Key } from "../../shared/i18n/i18n";

/** ウィンドウの大きさのプリセット(小・中・大)。 */
export const SIZE_PRESETS: { label: Key; width: number; height: number }[] = [
  { label: "sizeS", width: 420, height: 600 },
  { label: "sizeM", width: 520, height: 720 },
  { label: "sizeL", width: 680, height: 900 },
];

// 背景の色の並び(グレー・ダーク・ライト・Windows テーマ・好きな色・画像)と揃えて、「背景と同じ」は、画像と同じ右下に置く
/** UI の色の選択肢。背景の色の並びと揃えて、「背景と同じ」は、画像と同じ右下に置く。 */
export const UI_THEMES: { id: UiTheme; label: Key }[] = [
  { id: "gray", label: "themeGray" },
  { id: "dark", label: "themeDark" },
  { id: "white", label: "themeLight" },
  { id: "accent", label: "themeAccent" },
  { id: "custom", label: "themeCustom" },
  { id: "auto", label: "uiAuto" },
];

/** 背景の色の選択肢(クリア・ダーク・ライト・Windows テーマ・好きな色・画像)。 */
export const THEMES: { id: Theme; label: Key }[] = [
  { id: "gray", label: "themeGray" },
  { id: "dark", label: "themeDark" },
  { id: "white", label: "themeLight" },
  { id: "accent", label: "themeAccent" },
  { id: "custom", label: "themeCustom" },
  { id: "image", label: "themeImage" },
];

/**
 * キーボードのキーコード(`KeyboardEvent.code`)から、ショートカットの文字列で使うキー名を作る。
 * @param code 例: `ControlLeft` / `KeyL` / `Space`
 * @returns `Ctrl` / `Alt` / `Shift` / `Win` / `L` / `1` / `F5` / `Space` など。使えないキーは `null`
 */
export function keyName(code: string): string | null {
  if (code.startsWith("Control")) return "Ctrl";
  if (code.startsWith("Alt")) return "Alt";
  if (code.startsWith("Shift")) return "Shift";
  if (code.startsWith("Meta")) return "Win";
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^F([1-9]|1[0-2])$/.test(code)) return code;
  return ["Space", "Tab", "Enter", "Backquote", "Minus", "Equal", "Comma", "Period", "Slash"].includes(code)
    ? code
    : null;
}

/**
 * キーボードで打った色のコードを、設定に保存できる形(`#rrggbb`。小文字)にそろえる。
 * `#` は、あってもなくてもよく、3 桁(`#abc` = `#aabbcc`)も使える。前後の空白と、大文字・小文字は気にしない。
 * @param input 打った文字(例: `#3B82F6` / `3b82f6` / `f80`)
 * @returns `#rrggbb`。色として読めないときは `null`
 */
export function normalizeHex(input: string): string | null {
  const s = input.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{6}$/.test(s)) return `#${s}`;
  if (/^[0-9a-f]{3}$/.test(s)) return `#${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}`;
  return null;
}

/** 修飾キーの名前の一覧。 */
const MODIFIERS = ["Ctrl", "Alt", "Shift", "Win"];

/**
 * ショートカットとして使える組み合わせか調べる(先頭が修飾キーで、全体が 2〜3 キー。重複なし)。Rust 側の `parse_hotkey` と同じ決まり。
 * @param keys 押された順のキー名
 * @returns 使えるなら `true`
 */
export function validHotkey(keys: string[]): boolean {
  if (keys.length < 2 || keys.length > 3) return false;
  let i = 0;
  while (i < keys.length && MODIFIERS.includes(keys[i])) i++;
  const rest = keys.length - i;
  return i >= 1 && rest >= 1 && rest <= 2 && new Set(keys).size === keys.length;
}
