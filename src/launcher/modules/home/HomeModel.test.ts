import { describe, expect, it } from "vitest";
import { entryKey } from "./HomeModel";

describe("entryKey", () => {
  it("フォルダは f:<ID>、ショートカットは i:<パス>、空きは slot", () => {
    expect(entryKey({ kind: "folder", folder: { id: "x1", name: "N", path: "C:\\p" } })).toBe("f:x1");
    expect(entryKey({ kind: "item", item: { name: "a.lnk", path: "C:\\a.lnk" } })).toBe("i:C:\\a.lnk");
    expect(entryKey({ kind: "slot" })).toBe("slot");
  });
});
