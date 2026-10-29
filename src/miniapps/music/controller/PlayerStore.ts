import { api } from "../../../launcher/shared/api/ApiModel";
import { clamp01 } from "../../../launcher/shared/lib/MathUtil";
import { MAX_USER_LISTS, defaultListName, favListName, savePaths, type Repeat, type Saved } from "./PlayerModel";
import { type PlayList } from "./Playlists";

/**
 * 保存する内容(キーと文字列の組)を作る。設定と、プレイリストの名前を `music`、マイリストの曲を `music_fav`、プレイリストごとの曲を `music_p0`〜 に分ける。
 * @param s プレイヤーのいまの設定・プレイリスト
 */
export function buildEntries(
  s: PlayerSettings & { lists: PlayList[]; active: number; index: number },
): Record<string, string> {
  const base: Saved = {
    names: s.lists.slice(1).map((l) => l.name),
    active: s.active - 1, // -1 は、マイリスト
    fav: true,
    index: s.index,
    volume: s.volume,
    muted: s.muted,
    shuffle: s.shuffle,
    repeat: s.repeat,
    rate: s.rate,
  };
  const out: Record<string, string> = { music: JSON.stringify(base) };
  out.music_fav = savePaths(s.lists[0].tracks);
  for (let j = 0; j < MAX_USER_LISTS; j++) out[`music_p${j}`] = savePaths(s.lists[j + 1]?.tracks ?? []);
  return out;
}

/**
 * 保存したプレイリストを読み出す(音声ファイルは登録し直す。消えたものは除かれる)。
 * 以前の形式(曲のパスが 1 つの一覧)は、1 つ目のプレイリストとして引き継ぐ。
 * @param s 保存した設定(`music` の項目)
 * @param read 保存した項目を読む関数(キー → 文字列。無ければ `undefined`)
 * @returns プレイリスト(先頭は、マイリスト)
 */
async function loadLists(s: Saved, read: (key: string) => string | undefined): Promise<PlayList[]> {
  const names =
    Array.isArray(s.names) && s.names.length > 0
      ? s.names.slice(0, MAX_USER_LISTS).map((n) => String(n).slice(0, 30))
      : [defaultListName(1)];
  const readPaths = (key: string, legacy?: unknown): string[] => {
    try {
      const v: unknown = legacy ?? JSON.parse(read(key) ?? "[]");
      return Array.isArray(v) ? v.filter((p): p is string => typeof p === "string") : [];
    } catch {
      return []; // 壊れていたら空
    }
  };
  const load = async (name: string, paths: string[]) => ({
    name,
    tracks: paths.length > 0 ? await api.musicRegister(paths) : [],
  });
  const lists = [await load(favListName(), readPaths("music_fav"))];
  for (let i = 0; i < names.length; i++)
    lists.push(await load(names[i], readPaths(`music_p${i}`, i === 0 && Array.isArray(s.paths) ? s.paths : undefined)));
  return lists;
}

/** プレーヤーの設定(保存するもの)。 */
export interface PlayerSettings {
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: Repeat;
  rate: number;
}

/** 最初の設定。 */
export const defaultSettings = (): PlayerSettings => ({
  volume: 1,
  muted: false,
  shuffle: false,
  repeat: "off",
  rate: 1,
});

/**
 * 保存した設定(`music` の項目)を、範囲に収めて読み出す(音量は 0〜1、速度は 0.5〜2 倍)。保存になかったものは、含めない。
 * @param s 保存した設定
 */
function readSettings(s: Saved): Partial<PlayerSettings> {
  const out: Partial<PlayerSettings> = { muted: !!s.muted, shuffle: !!s.shuffle };
  if (typeof s.volume === "number") out.volume = clamp01(s.volume);
  if (s.repeat === "all" || s.repeat === "one") out.repeat = s.repeat;
  if (typeof s.rate === "number") out.rate = Math.min(2, Math.max(0.5, s.rate));
  return out;
}

/** 設定とプレイリストの保存を、少し待って(400ms)まとめて、渡された関数へ送る。 */
export class Persister {
  private fn: ((entries: Record<string, string>) => void) | null = null;
  private timer: number | undefined;

  /**
   * 保存する内容を渡す先を決める。
   * @param fn 保存する内容(キーと文字列の組)を受け取る関数
   */
  setTarget(fn: (entries: Record<string, string>) => void) {
    this.fn = fn;
  }
  /**
   * 保存を予約する(続けて呼ばれたら、最後の 1 回だけ)。
   * @param build 保存する内容を作る関数(送る直前に呼ぶ)
   */
  schedule(build: () => Record<string, string>) {
    if (!this.fn) return;
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.fn?.(build()), 400);
  }
  /** 予約を取り消す。 */
  cancel() {
    clearTimeout(this.timer);
    this.timer = undefined;
  }
}

/**
 * 前回の保存(`music` / `music_fav` / `music_p0`〜)を読み出す(音声ファイルは登録し直す。消えたものは除かれる)。
 * @param read 保存した項目を読む関数(キー → 文字列。無ければ `undefined`)
 * @returns 設定・プレイリスト・開く番号(マイリストが 0)・選んでいた曲の番号。保存が無ければ `null`。壊れていれば、例外
 */
export async function restoreState(read: (key: string) => string | undefined) {
  const json = read("music");
  if (!json) return null;
  const s = JSON.parse(json) as Saved;
  return {
    settings: readSettings(s),
    lists: await loadLists(s, read),
    active: typeof s.active === "number" ? s.active + 1 : 1,
    index: typeof s.index === "number" ? s.index : undefined,
  };
}
