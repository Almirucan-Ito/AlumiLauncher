import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RenameItemDialog } from "./RenameItemDialog";

afterEach(cleanup);

const item = { name: "Google Chrome.lnk", path: "C:\\home\\Google Chrome.lnk" };
const input = () => screen.getByRole("textbox") as HTMLInputElement;
const saveBtn = () => screen.getByRole("button", { name: /保存|Save/ }) as HTMLButtonElement;

describe("RenameItemDialog(ファイル名の変更)", () => {
  it("名前の部分だけを入力欄に出し、拡張子は、そのまま横に出す", () => {
    render(<RenameItemDialog item={item} onSave={() => {}} onCancel={() => {}} />);
    expect(input().value).toBe("Google Chrome");
    expect(screen.getByText(".lnk")).toBeTruthy();
  });

  it("新しい名前で保存すると、拡張子を付けた名前で渡す", () => {
    const onSave = vi.fn();
    render(<RenameItemDialog item={item} onSave={onSave} onCancel={() => {}} />);
    fireEvent.change(input(), { target: { value: "ブラウザ" } });
    fireEvent.click(saveBtn());
    expect(onSave).toHaveBeenCalledWith("ブラウザ.lnk");
  });

  it("使えない名前のときは、保存できず、理由を出す", () => {
    const onSave = vi.fn();
    render(<RenameItemDialog item={item} onSave={onSave} onCancel={() => {}} />);
    fireEvent.change(input(), { target: { value: "a/b" } });
    expect(saveBtn().disabled).toBe(true);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(input().getAttribute("aria-invalid")).toBe("true");
    fireEvent.submit(input().closest("form")!);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("空にすると、保存できない", () => {
    render(<RenameItemDialog item={item} onSave={() => {}} onCancel={() => {}} />);
    fireEvent.change(input(), { target: { value: "" } });
    expect(saveBtn().disabled).toBe(true);
  });

  it("Esc で取り消す", () => {
    const onCancel = vi.fn();
    render(<RenameItemDialog item={item} onSave={() => {}} onCancel={onCancel} />);
    fireEvent.keyDown(input(), { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });

  it("拡張子の無いファイルは、拡張子の表示が無く、そのままの名前で渡す", () => {
    const onSave = vi.fn();
    render(
      <RenameItemDialog item={{ name: "README", path: "C:\\home\\README" }} onSave={onSave} onCancel={() => {}} />,
    );
    fireEvent.change(input(), { target: { value: "はじめに" } });
    fireEvent.click(saveBtn());
    expect(onSave).toHaveBeenCalledWith("はじめに");
  });
});
