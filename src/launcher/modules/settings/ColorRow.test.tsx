import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ColorRow } from "./ColorRow";

// テストごとに、描いたものを片付ける(前のテストの入力欄が残って、見つけ間違えないように)
afterEach(cleanup);

/** 色のコードの入力欄(テキスト)を返す。 */
const hexInput = () => screen.getByLabelText(/色のコード|Color code/) as HTMLInputElement;

describe("ColorRow(好きな色。キーボードで入力できる)", () => {
  it("いまの色のコードを、入力欄に出す", () => {
    render(<ColorRow value="#3b82f6" onChange={() => {}} />);
    expect(hexInput().value).toBe("#3b82f6");
  });

  it("6 桁そろった時点で、反映する(# なしも使える)", () => {
    const onChange = vi.fn();
    render(<ColorRow value="#3b82f6" onChange={onChange} />);
    fireEvent.change(hexInput(), { target: { value: "ff0000" } });
    expect(onChange).toHaveBeenCalledWith("#ff0000");
    expect(hexInput().value).toBe("#ff0000");
  });

  it("打っている途中(6 桁になる前)は、反映しない", () => {
    const onChange = vi.fn();
    render(<ColorRow value="#3b82f6" onChange={onChange} />);
    fireEvent.change(hexInput(), { target: { value: "#ff00" } });
    expect(onChange).not.toHaveBeenCalled();
    expect(hexInput().getAttribute("aria-invalid")).toBe("true");
  });

  it("3 桁は、Enter で 6 桁に広げて反映する", () => {
    const onChange = vi.fn();
    render(<ColorRow value="#3b82f6" onChange={onChange} />);
    fireEvent.change(hexInput(), { target: { value: "f80" } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(hexInput(), { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("#ff8800");
  });

  it("読めない文字のまま欄を離れたら、元の色のコードに戻す", () => {
    const onChange = vi.fn();
    render(<ColorRow value="#3b82f6" onChange={onChange} />);
    fireEvent.change(hexInput(), { target: { value: "red" } });
    fireEvent.blur(hexInput());
    expect(onChange).not.toHaveBeenCalled();
    expect(hexInput().value).toBe("#3b82f6");
    expect(hexInput().getAttribute("aria-invalid")).toBe("false");
  });

  it("色見本などで色が変わったら、入力欄も合わせる", () => {
    const { rerender } = render(<ColorRow value="#3b82f6" onChange={() => {}} />);
    rerender(<ColorRow value="#22c55e" onChange={() => {}} />);
    expect(hexInput().value).toBe("#22c55e");
  });
});
