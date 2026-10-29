import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type Config, type FolderEntry } from "../../shared/api/ApiModel";
import { useUndoHistory } from "./useUndoHistory";

const folder = (id: string, name: string): FolderEntry => ({ id, name, path: `C:\\${id}` });

/** テスト用の、設定の入れ物(最新の設定を持つ ref と、変更を適用する関数)。 */
function setup(folders: FolderEntry[] = [folder("a", "A")]) {
  const configRef = { current: { folders, orders: {}, settings: {} } as unknown as Config };
  const mutate = (fn: (c: Config) => Config) => {
    configRef.current = fn(configRef.current);
  };
  const onRestored = vi.fn();
  const flash = vi.fn();
  const hook = renderHook(() => useUndoHistory({ configRef, mutate, onRestored, flash }));
  return { configRef, mutate, onRestored, flash, hook };
}

/** Ctrl+(キー)を押す。 */
const press = async (key: string, shift = false) => {
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, ctrlKey: true, shiftKey: shift, bubbles: true }));
    await Promise.resolve();
  });
};

describe("useUndoHistory", () => {
  it("recorded で行った変更を、Ctrl+Z で戻し、Ctrl+Y でやり直せる", async () => {
    const { configRef, mutate, onRestored, hook } = setup();
    act(() => hook.result.current.recorded(() => mutate((c) => ({ ...c, folders: [...c.folders, folder("b", "B")] }))));
    expect(configRef.current.folders.map((f) => f.id)).toEqual(["a", "b"]);

    await press("z");
    expect(configRef.current.folders.map((f) => f.id)).toEqual(["a"]);
    expect(onRestored).toHaveBeenCalledTimes(1);

    await press("y");
    expect(configRef.current.folders.map((f) => f.id)).toEqual(["a", "b"]);
    expect(onRestored).toHaveBeenCalledTimes(2);
  });

  it("Ctrl+Shift+Z でも、やり直せる", async () => {
    const { configRef, mutate, hook } = setup();
    act(() => hook.result.current.recorded(() => mutate((c) => ({ ...c, folders: [] }))));
    await press("z");
    expect(configRef.current.folders).toHaveLength(1);
    await press("z", true);
    expect(configRef.current.folders).toHaveLength(0);
  });

  it("履歴が空のときは、何も起きない", async () => {
    const { configRef, onRestored } = setup();
    await press("z");
    expect(configRef.current.folders).toHaveLength(1);
    expect(onRestored).not.toHaveBeenCalled();
  });

  it("履歴は、最大 5 件", async () => {
    const { configRef, mutate, hook } = setup([]);
    for (let i = 0; i < 7; i++) {
      act(() =>
        hook.result.current.recorded(() => mutate((c) => ({ ...c, folders: [...c.folders, folder(`f${i}`, "x")] }))),
      );
    }
    for (let i = 0; i < 10; i++) await press("z");
    expect(configRef.current.folders).toHaveLength(2); // 7 件のうち、戻せたのは最近の 5 件
  });

  it("新しい操作をすると、やり直しの履歴は捨てる", async () => {
    const { configRef, mutate, hook } = setup();
    act(() => hook.result.current.recorded(() => mutate((c) => ({ ...c, folders: [...c.folders, folder("b", "B")] }))));
    await press("z");
    act(() => hook.result.current.recorded(() => mutate((c) => ({ ...c, folders: [...c.folders, folder("c", "C")] }))));
    await press("y"); // やり直せるものは、もうない
    expect(configRef.current.folders.map((f) => f.id)).toEqual(["a", "c"]);
  });

  it("clearHistory で、履歴を全部捨てる", async () => {
    const { configRef, mutate, hook } = setup();
    act(() => hook.result.current.recorded(() => mutate((c) => ({ ...c, folders: [] }))));
    act(() => hook.result.current.clearHistory());
    await press("z");
    expect(configRef.current.folders).toHaveLength(0);
  });

  it("入力欄の中では、Ctrl+Z を横取りしない", async () => {
    const { configRef, mutate, hook } = setup();
    act(() => hook.result.current.recorded(() => mutate((c) => ({ ...c, folders: [] }))));
    const input = document.createElement("input");
    document.body.appendChild(input);
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }));
      await Promise.resolve();
    });
    expect(configRef.current.folders).toHaveLength(0);
    input.remove();
  });

  it("続けた並べ替えは、1 回の操作にまとまる", async () => {
    const { configRef, mutate, hook } = setup();
    vi.useFakeTimers();
    const order = (paths: string[]) => mutate((c) => ({ ...c, orders: { ...c.orders, a: paths } }));
    act(() => hook.result.current.reorderRecorded(() => order(["1"])));
    act(() => hook.result.current.reorderRecorded(() => order(["2", "1"])));
    act(() => hook.result.current.reorderRecorded(() => order(["3", "2", "1"])));
    act(() => {
      vi.advanceTimersByTime(1300);
    });
    vi.useRealTimers();
    await press("z");
    expect(configRef.current.orders).toEqual({}); // 3 回の並べ替えが、1 回で元へ
  });
});
