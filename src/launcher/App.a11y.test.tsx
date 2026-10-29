import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { App } from "./App";
import { t } from "./shared/i18n/i18n";

/** jsdom に無い、画面が使うブラウザの機能を、何もしない形で用意する。 */
beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  g.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  g.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
  window.matchMedia ??= ((q: string) => ({
    matches: false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  Element.prototype.scrollTo ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

afterEach(cleanup);

/**
 * axe-core で、いまの画面の問題を探す。
 * 色のコントラストは、jsdom では計算できない(スタイルが当たらない)ので、対象外。
 */
async function violations(): Promise<string[]> {
  const result = await axe.run(document.body, { rules: { "color-contrast": { enabled: false } } });
  return result.violations.map(
    (v) => `${v.id}: ${v.help}\n${v.nodes.map((n) => `  ${n.target.join(" ")} ${n.html.slice(0, 100)}`).join("\n")}`,
  );
}

describe("アクセシビリティ(axe-core)", () => {
  it("ホーム画面に、問題がない", async () => {
    render(<App />);
    await waitFor(() => expect(document.querySelectorAll(".tile").length).toBeGreaterThan(0), { timeout: 4000 });
    expect(await violations()).toEqual([]);
  });

  it("設定の画面に、問題がない", async () => {
    render(<App />);
    await waitFor(() => expect(document.querySelectorAll(".tile").length).toBeGreaterThan(0), { timeout: 4000 });
    fireEvent.click(screen.getByRole("button", { name: t("settings") }));
    await waitFor(() => expect(document.querySelector(".settings")).not.toBeNull());
    expect(await violations()).toEqual([]);
  });

  it("フォルダを開いた画面に、問題がない", async () => {
    render(<App />);
    await waitFor(() => expect(document.querySelectorAll(".tile").length).toBeGreaterThan(0), { timeout: 4000 });
    fireEvent.click(document.querySelector(".tile")!);
    await screen.findByRole("dialog", {}, { timeout: 4000 });
    expect(await violations()).toEqual([]);
  });

  it("「＋」のメニューに、問題がない", async () => {
    render(<App />);
    await waitFor(() => expect(document.querySelectorAll(".tile").length).toBeGreaterThan(0), { timeout: 4000 });
    fireEvent.click(screen.getByRole("button", { name: t("plusTitle") }));
    await screen.findByText(t("addFromStart"));
    expect(await violations()).toEqual([]);
  });
});
