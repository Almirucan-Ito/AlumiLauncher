import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type Config, DEFAULT_SETTINGS } from "../../shared/api/ApiModel";
import { normalizeSettings } from "../settings/normalizeSettings";
import { themeVarsOf } from "../settings/ThemeModel";
import { useEscapeKey, usePresetKeys, useReloadKeys } from "./useGlobalKeys";
import { useToast } from "./useToast";

/** window にキーを押したことにする。 */
const press = (init: KeyboardEventInit) => act(() => void window.dispatchEvent(new KeyboardEvent("keydown", init)));

describe("normalizeSettings", () => {
  it("設定が無くても、初期値で補う", () => {
    expect(normalizeSettings(null)).toMatchObject({
      theme: DEFAULT_SETTINGS.theme,
      presetCount: DEFAULT_SETTINGS.presetCount,
    });
  });

  it("古い設定ファイルの、無い(null)ウィジェット一覧などを、使える形にそろえる。ヘッダー・フッターの高さは、小・標準・大のどれかにする", () => {
    const old = { folders: [], settings: { headerWidgets: null, widgetScales: null, widgetData: null, headerRows: 9 } };
    const s = normalizeSettings(old as unknown as Config);
    expect(s.headerWidgets).toEqual(DEFAULT_SETTINGS.headerWidgets);
    expect(s.widgetScales).toEqual({});
    expect(s.widgetData).toEqual({});
    expect(s.headerRows).toBe(2);
  });
});

describe("themeVarsOf", () => {
  const settings = normalizeSettings(null);
  it("アイコンの大きさ・間隔と、テーマカラーを、CSS の変数にする", () => {
    const v = themeVarsOf(settings, "#123456", 44, 8, null);
    expect(v["--icon-size"]).toBe("44px");
    expect(v["--icon-gap"]).toBe("8px");
    expect(v["--sys-accent"]).toBe("#123456");
    expect(v["--bgimg"]).toBeUndefined();
  });
  it("背景画像があれば、--bgimg を足す", () => {
    expect(themeVarsOf(settings, "#000", 44, 8, "blob:x")["--bgimg"]).toBe('url("blob:x")');
  });
});

describe("useToast", () => {
  it("flash で出して、2.4 秒後に消す。続けて別の文言を出したら、前の分のタイマーでは消えない", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useToast());
    act(() => result.current.flash("A"));
    expect(result.current.toast).toBe("A");
    act(() => vi.advanceTimersByTime(1000));
    act(() => result.current.flash("B"));
    act(() => vi.advanceTimersByTime(1500)); // A のタイマーが切れる(B はまだ)
    expect(result.current.toast).toBe("B");
    act(() => vi.advanceTimersByTime(1000)); // B のタイマーも切れる
    expect(result.current.toast).toBeNull();
    vi.useRealTimers();
  });
});

describe("useEscapeKey", () => {
  const none = {
    folderOpen: false,
    renaming: false,
    deleting: false,
    miniOpen: false,
    picking: false,
    menu: false,
    settings: false,
  };
  const close = () => ({ mini: vi.fn(), pickers: vi.fn(), menu: vi.fn(), settings: vi.fn(), hideWindow: vi.fn() });

  it("何も開いていなければ、ウィンドウを隠す。デスクトップモードでは、隠さない", () => {
    const c = close();
    const { rerender } = renderHook(({ desktop }) => useEscapeKey(none, desktop, c), {
      initialProps: { desktop: false },
    });
    press({ key: "Escape" });
    expect(c.hideWindow).toHaveBeenCalledTimes(1);
    rerender({ desktop: true });
    press({ key: "Escape" });
    expect(c.hideWindow).toHaveBeenCalledTimes(1);
  });

  it("手前から順に閉じる: ミニアプリ → 一覧 → メニュー → 設定", () => {
    const c = close();
    renderHook(() => useEscapeKey({ ...none, miniOpen: true, picking: true, menu: true, settings: true }, false, c));
    press({ key: "Escape" });
    expect(c.mini).toHaveBeenCalledTimes(1);
    expect(c.pickers).not.toHaveBeenCalled();
    const c2 = close();
    renderHook(() => useEscapeKey({ ...none, menu: true, settings: true }, false, c2));
    press({ key: "Escape" });
    expect(c2.menu).toHaveBeenCalledTimes(1);
    expect(c2.settings).not.toHaveBeenCalled();
  });

  it("フォルダ・名前の変更・削除の確認が開いているときは、その画面に任せて、何もしない", () => {
    const c = close();
    renderHook(() => useEscapeKey({ ...none, folderOpen: true, menu: true }, false, c));
    press({ key: "Escape" });
    expect(c.hideWindow).not.toHaveBeenCalled();
    expect(c.menu).not.toHaveBeenCalled();
  });
});

describe("useReloadKeys", () => {
  it("R と F5 で再読み込みする。Ctrl+R は対象外", () => {
    const reload = vi.fn();
    renderHook(() => useReloadKeys(false, false, reload));
    press({ key: "r" });
    press({ key: "F5" });
    press({ key: "r", ctrlKey: true });
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("ダイアログなどを開いている間は、F5 も R も再読み込みしない。ミニアプリなどの間は、R だけしない", () => {
    const a = vi.fn();
    renderHook(() => useReloadKeys(true, true, a));
    press({ key: "r" });
    press({ key: "F5" });
    expect(a).not.toHaveBeenCalled();
    const b = vi.fn();
    renderHook(() => useReloadKeys(false, true, b));
    press({ key: "r" });
    press({ key: "F5" });
    expect(b).toHaveBeenCalledTimes(1);
  });
});

describe("usePresetKeys", () => {
  it("数字キーで番号を、Alt+←/→ と Home/End で前・次を、受け取る", () => {
    const on = vi.fn();
    renderHook(() => usePresetKeys(on));
    press({ key: "2", code: "Digit2" });
    press({ key: "ArrowRight", altKey: true });
    press({ key: "ArrowLeft", altKey: true });
    press({ key: "End" });
    press({ key: "Home" });
    expect(on.mock.calls.map((c) => c[0])).toEqual([{ n: 2 }, { dir: 1 }, { dir: -1 }, { dir: 1 }, { dir: -1 }]);
  });

  it("Shift や Win を押しているとき、関係のないキーのときは、受け取らない", () => {
    const on = vi.fn();
    renderHook(() => usePresetKeys(on));
    press({ key: "2", code: "Digit2", shiftKey: true });
    press({ key: "a", code: "KeyA" });
    expect(on).not.toHaveBeenCalled();
  });
});
