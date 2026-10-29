import { describe, expect, it } from "vitest";
import { type MusicTrack } from "../../../launcher/shared/api/ApiModel";
import { MAX_LISTS } from "./PlayerModel";
import { MAX_TRACKS, Playlists } from "./Playlists";

/** 試験用の曲(パスから名前と URL を作る)。 */
const track = (p: string): MusicTrack => ({ path: p, name: p, url: `asset://${p}` }) as MusicTrack;

describe("Playlists", () => {
  it("最初は、マイリストと、プレイリスト 1 の 2 つ。開いているのは 1 番", () => {
    const pl = new Playlists();
    expect(pl.lists).toHaveLength(2);
    expect(pl.active).toBe(1);
  });

  it("曲を足す: 同じ曲は足さない・上限まで", () => {
    const pl = new Playlists();
    pl.add([track("a"), track("b")]);
    pl.add([track("b"), track("c")]);
    expect(pl.tracks.map((t) => t.path)).toEqual(["a", "b", "c"]);
    pl.add(Array.from({ length: MAX_TRACKS + 10 }, (_, i) => track(`x${i}`)));
    expect(pl.tracks).toHaveLength(MAX_TRACKS);
  });

  it("プレイリストを作る: 上限まで。名前は 30 字まで・空なら既定の名前", () => {
    const pl = new Playlists();
    expect(pl.create("  " + "あ".repeat(40))).toBe(true);
    expect(pl.lists[2].name).toBe("あ".repeat(30));
    expect(pl.create("")).toBe(true);
    expect(pl.lists[3].name).toMatch(/4$/);
    while (pl.create()) {
      /* 上限まで作る */
    }
    expect(pl.lists).toHaveLength(MAX_LISTS);
  });

  it("名前の変更: マイリストと空の名前は、変えられない", () => {
    const pl = new Playlists();
    expect(pl.rename(0, "x")).toBe(false);
    expect(pl.rename(1, "  ")).toBe(false);
    expect(pl.rename(1, " 作業用 ")).toBe(true);
    expect(pl.names[1]).toBe("作業用");
  });

  it("消す: マイリストは消せない。1 つだけなら、消さずに空にする", () => {
    const pl = new Playlists();
    expect(pl.delete(0)).toBeNull();
    pl.add([track("a")]);
    expect(pl.delete(1)).toEqual({ reset: true, reselect: false });
    expect(pl.lists).toHaveLength(2);
    expect(pl.tracks).toHaveLength(0);
  });

  it("消す: 開いているものより前を消すと、開いているものの番号が 1 つ減る", () => {
    const pl = new Playlists();
    pl.create("B");
    pl.create("C");
    pl.active = 3;
    expect(pl.delete(1)).toEqual({ reset: true, reselect: true });
    expect(pl.active).toBe(2);
    expect(pl.names).toEqual([pl.names[0], "B", "C"]);
  });

  it("消す: 開いているものより後ろを消しても、開いているものは変わらない", () => {
    const pl = new Playlists();
    pl.create("B");
    const v = pl.version;
    expect(pl.delete(2)).toEqual({ reset: false, reselect: false });
    expect(pl.active).toBe(1);
    expect(pl.version).toBe(v);
  });

  it("消す: 開いているものが最後なら、1 つ前を開く", () => {
    const pl = new Playlists();
    pl.create("B");
    pl.active = 2;
    pl.delete(2);
    expect(pl.active).toBe(1);
  });

  it("マイリスト: 入れる・外す。マイリストを開いて外すと、消す(呼んだ側)", () => {
    const pl = new Playlists();
    pl.add([track("a")]);
    expect(pl.toggleFavorite(0)).toBe("toggled");
    expect(pl.isFavorite("a")).toBe(true);
    expect(pl.toggleFavorite(0)).toBe("toggled");
    expect(pl.isFavorite("a")).toBe(false);
    expect(pl.toggleFavorite(5)).toBe("none");
    pl.toggleFavorite(0);
    pl.active = 0;
    expect(pl.toggleFavorite(0)).toBe("remove");
  });

  it("コピー: 同じ曲があれば、しない。開いているものへも、しない", () => {
    const pl = new Playlists();
    pl.create("B");
    pl.add([track("a")]);
    expect(pl.copyTrack(0, 2)).toBe(true);
    expect(pl.copyTrack(0, 2)).toBe(false);
    expect(pl.copyTrack(0, 1)).toBe(false);
    expect(pl.copyTrack(9, 2)).toBe(false);
  });

  it("並べ替え: 範囲外・同じ位置は、何もしない", () => {
    const pl = new Playlists();
    pl.add([track("a"), track("b"), track("c")]);
    expect(pl.move(0, 2)).toBe(true);
    expect(pl.tracks.map((t) => t.path)).toEqual(["b", "c", "a"]);
    expect(pl.move(1, 1)).toBe(false);
    expect(pl.move(0, 3)).toBe(false);
  });

  it("保存から戻す: 開く番号が範囲外なら 1 番", () => {
    const pl = new Playlists();
    pl.replace(Playlists.initial(), 7);
    expect(pl.active).toBe(1);
  });
});
