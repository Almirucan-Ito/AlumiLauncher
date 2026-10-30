import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useLatest } from "./useLatest";

describe("useLatest", () => {
  it("描画のたびに、最新の値が入る(参照そのものは変わらない)", () => {
    const { result, rerender } = renderHook(({ v }) => useLatest(v), { initialProps: { v: 1 } });
    const first = result.current;
    expect(first.current).toBe(1);
    rerender({ v: 2 });
    expect(result.current).toBe(first);
    expect(result.current.current).toBe(2);
  });

  it("関数も、最新のものを呼べる", () => {
    const { result, rerender } = renderHook(({ n }) => useLatest(() => n * 10), { initialProps: { n: 1 } });
    rerender({ n: 5 });
    expect(result.current.current()).toBe(50);
  });
});
