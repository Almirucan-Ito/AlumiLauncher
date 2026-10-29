import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../shared/api/ApiModel";
import { type HomeEntry } from "./HomeModel";
import { useHomeSearch } from "./useHomeSearch";

const entries: HomeEntry[] = [
  { kind: "folder", folder: { id: "w", name: "仕事", path: "C:\\work" } },
  { kind: "item", item: { name: "Google Chrome.lnk", path: "C:\\home\\Google Chrome.lnk" } },
  { kind: "item", item: { name: "Brave.lnk", path: "C:\\home\\Brave.lnk" } },
  { kind: "slot" },
];

/** ホームの並びを持たせて、検索のフックを動かす。 */
function setup() {
  const setOpen = vi.fn();
  const entriesRef = { current: entries };
  const hook = renderHook(() => useHomeSearch(entriesRef, setOpen));
  return { setOpen, hook };
}

afterEach(() => vi.restoreAllMocks());

describe("useHomeSearch", () => {
  it("入力が空のうちは、絞り込まない(q が空)", () => {
    const { hook } = setup();
    expect(hook.result.current.q).toBe("");
  });

  it("名前に、探す文字(大文字・小文字は区別しない)が含まれる項目だけが、当たる。空きは当たらない", () => {
    const { hook } = setup();
    act(() => hook.result.current.setQuery("  CHROME "));
    const { q, entryMatches } = hook.result.current;
    expect(q).toBe("chrome");
    expect(entries.map((e) => entryMatches(e))).toEqual([false, true, false, false]);
  });

  it("フォルダは、フォルダ名が当たったとき、当たる", () => {
    const { hook } = setup();
    act(() => hook.result.current.setQuery("仕事"));
    expect(hook.result.current.entryMatches(entries[0])).toBe(true);
  });

  it("Enter で、最初に当たったアイコンを起動する", () => {
    const launch = vi.spyOn(api, "launch").mockResolvedValue(undefined);
    const { hook } = setup();
    act(() => hook.result.current.setQuery("brave"));
    hook.result.current.onSearchEnter();
    expect(launch).toHaveBeenCalledWith("C:\\home\\Brave.lnk");
  });

  it("Enter で、フォルダ名に当たったときは、そのフォルダを開く", () => {
    const launch = vi.spyOn(api, "launch").mockResolvedValue(undefined);
    const { hook, setOpen } = setup();
    act(() => hook.result.current.setQuery("仕事"));
    hook.result.current.onSearchEnter();
    expect(launch).not.toHaveBeenCalled();
    expect(setOpen).toHaveBeenCalledTimes(1);
    expect(setOpen.mock.calls[0][0].folder.id).toBe("w");
  });

  it("入力が空のときの Enter では、何もしない", () => {
    const launch = vi.spyOn(api, "launch").mockResolvedValue(undefined);
    const { hook, setOpen } = setup();
    hook.result.current.onSearchEnter();
    expect(launch).not.toHaveBeenCalled();
    expect(setOpen).not.toHaveBeenCalled();
  });
});
