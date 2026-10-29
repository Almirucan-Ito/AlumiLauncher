import { isJa } from "../../../launcher/shared/lib/LangUtil";
import { type MusicTrack } from "../../../launcher/shared/api/ApiModel";

/**
 * 音楽プレーヤーの本体の繰り返し設定: `"off"`(しない)/ `"all"`(全曲)/ `"one"`(1 曲)。
 * プレーヤーは、ランチャー本体(画面側)に 1 つだけあり、ミニアプリ「ミュージック」を閉じても、ウィジェットで操作しながら、再生を続けられる。ミニアプリやウィジェットは、これを操作するだけ。
 */
export type Repeat = "off" | "all" | "one";

/** プレーヤーの状態(画面・ミニアプリへ渡す写し)。変わるたびに、新しい値が作られる。 */
export interface PlayerState {
  /** 曲の数と、いま選んでいる曲(-1 は無し) */
  count: number;
  index: number;
  title: string;
  playing: boolean;
  position: number;
  duration: number;
  /** プレーヤーの音量(0〜1)。ランチャー全体の音量は、これとは別に掛かる */
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: Repeat;
  rate: number;
  /** おやすみタイマーの残り(秒)。無ければ null */
  sleepLeft: number | null;
  /** 曲の一覧が変わるたびに増える番号(一覧の再送を、変わったときだけにするため) */
  tracksVersion: number;
  /** プレイリストの名前の一覧(先頭 0 番は、お気に入りの「マイリスト」)と、いま開いているもの */
  lists: string[];
  activeList: number;
  /** いま選んでいる曲が、マイリストに入っているか */
  fav: boolean;
}

/** 保存する内容(設定と、プレイリストの名前)。曲のパスは、プレイリストごとに別の項目(`music_p0`〜)へ保存する。 */
export interface Saved {
  /** 以前の形式(プレイリストが 1 つだけのとき)の曲のパス */
  paths?: string[];
  names?: string[];
  active?: number;
  fav?: boolean;
  index: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: Repeat;
  rate: number;
}

/** 保存するデータの大きさの上限(1 項目 64KB の上限より小さく)。 */
const SAVE_MAX = 56 * 1024;
/** プレイリストの数の上限(先頭の「マイリスト」を含む)。 */
export const MAX_LISTS = 9;
/** 自分で作れるプレイリストの数(マイリストを除く)。 */
export const MAX_USER_LISTS = MAX_LISTS - 1;

/** マイリスト(お気に入りの曲を集める先頭のプレイリスト)の名前。表示言語に合わせる。 */
export const favListName = () => (isJa ? "マイリスト" : "My list");

/**
 * 新しいプレイリストの、既定の名前(「プレイリスト 2」など)。
 * @param n 番号
 */
export const defaultListName = (n: number) => `${isJa ? "プレイリスト" : "Playlist"} ${n}`;

/**
 * 曲のパスを、保存する文字列(JSON)にする。大きさの上限(`SAVE_MAX`)を超える分は、保存しない。
 * @param tracks 曲の一覧
 * @returns パスの配列の JSON
 */
export function savePaths(tracks: MusicTrack[]): string {
  const paths: string[] = [];
  let size = 20;
  for (const t of tracks) {
    size += t.path.length + 4;
    if (size > SAVE_MAX) break;
    paths.push(t.path);
  }
  return JSON.stringify(paths);
}
