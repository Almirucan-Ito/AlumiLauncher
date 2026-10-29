import { type MusicTrack } from "../../../launcher/shared/api/ApiModel";
import { MAX_LISTS, defaultListName, favListName } from "./PlayerModel";

/** 1 つのプレイリストの曲の数の上限。 */
export const MAX_TRACKS = 3000;
/** プレイリストの名前の長さの上限(字)。 */
const NAME_MAX = 30;

/** プレイリスト 1 つ(名前と、曲の一覧)。 */
export interface PlayList {
  name: string;
  tracks: MusicTrack[];
}

/** 名前を、空白を除いて、長さの上限に収める。 */
const clipName = (name: string) => name.trim().slice(0, NAME_MAX);

/**
 * プレイリストの集まり(最大 `MAX_LISTS` 個)。先頭 0 番は、お気に入りの曲を集める「マイリスト」(消せない・名前も変えられない)。
 * 音(Audio)・再生中の曲の番号・保存・通知は持たない。曲の一覧の操作だけを受け持ち、プレーヤー(`PlayerController`)が、その結果に合わせて再生や保存をする。
 */
export class Playlists {
  lists: PlayList[] = Playlists.initial();
  /** いま開いている(再生の対象の)プレイリストの番号 */
  active = 1;
  /** 曲の一覧が変わるたびに増える番号 */
  version = 0;

  /** 最初の状態のプレイリスト(マイリストと、「プレイリスト 1」)。 */
  static initial(): PlayList[] {
    return [
      { name: favListName(), tracks: [] },
      { name: defaultListName(1), tracks: [] },
    ];
  }

  /** いま開いているプレイリストの曲の一覧。 */
  get tracks(): MusicTrack[] {
    return this.lists[this.active].tracks;
  }
  set tracks(v: MusicTrack[]) {
    this.lists[this.active].tracks = v;
  }
  /** プレイリストの名前の一覧。 */
  get names(): string[] {
    return this.lists.map((l) => l.name);
  }
  /**
   * 曲が、マイリストに入っているか。
   * @param path 曲のパス
   */
  isFavorite(path: string | undefined): boolean {
    return path !== undefined && this.lists[0].tracks.some((t) => t.path === path);
  }

  /** 最初の状態に戻す。 */
  reset() {
    this.lists = Playlists.initial();
    this.active = 1;
    this.version++;
  }
  /**
   * 保存から戻したプレイリストに入れ替える。
   * @param lists 戻したプレイリスト(先頭はマイリスト)
   * @param active 開く番号(範囲外なら 1)
   */
  replace(lists: PlayList[], active: number) {
    this.lists = lists;
    this.active = active >= 0 && active < lists.length ? active : 1;
    this.version++;
  }

  /**
   * プレイリストを足す。上限なら何もしない。開くのは、呼んだ側。
   * @param name 名前(30 字まで。空なら、「プレイリスト N」)
   * @returns 足したら `true`
   */
  create(name?: string): boolean {
    if (this.lists.length >= MAX_LISTS) return false;
    this.lists.push({ name: clipName(name ?? "") || defaultListName(this.lists.length + 1), tracks: [] });
    return true;
  }
  /**
   * 名前を変える。マイリスト(0 番)は変えられない。
   * @param i プレイリストの番号
   * @param name 新しい名前(30 字まで。空は無視)
   * @returns 変えたら `true`
   */
  rename(i: number, name: string): boolean {
    const n = clipName(name);
    if (i <= 0 || !this.lists[i] || !n) return false;
    this.lists[i].name = n;
    return true;
  }
  /**
   * プレイリストを消す。マイリストは消せない。自分のプレイリストが 1 つだけのときは、消さずに中身を空にする。
   * @param i プレイリストの番号
   * @returns 何も起きなければ `null`。そうでなければ、再生を止めるべきか `reset` と、先頭の曲を選び直すべきか `reselect`
   */
  delete(i: number): { reset: boolean; reselect: boolean } | null {
    if (i <= 0 || !this.lists[i]) return null;
    if (this.lists.length === 2) {
      this.lists[1].tracks = [];
      this.version++;
      return { reset: this.active === 1, reselect: false };
    }
    this.lists.splice(i, 1);
    if (this.active >= this.lists.length) this.active = this.lists.length - 1;
    else if (i < this.active) this.active--;
    else if (i !== this.active) return { reset: false, reselect: false }; // 開いているものより後ろ: 開いているものは変わらない
    this.version++;
    return { reset: true, reselect: true };
  }
  /**
   * 曲をマイリストに入れる/外す。
   * @param trackIndex いま開いているプレイリストの曲の番号
   * @returns `"none"` 何もしなかった / `"remove"` マイリストを開いているときの「外す」(一覧からも消す。呼んだ側が消す) / `"toggled"` 入れた・外した
   */
  toggleFavorite(trackIndex: number): "none" | "remove" | "toggled" {
    const t = this.tracks[trackIndex];
    if (!t) return "none";
    const fav = this.lists[0];
    const at = fav.tracks.findIndex((x) => x.path === t.path);
    if (at >= 0) {
      if (this.active === 0) return "remove";
      fav.tracks.splice(at, 1);
    } else {
      fav.tracks = [...fav.tracks, t].slice(0, MAX_TRACKS);
    }
    this.version++;
    return "toggled";
  }
  /**
   * いま開いているプレイリストの曲を、別のプレイリストへコピーする(同じ曲がすでにあれば、何もしない)。
   * @param trackIndex 曲の番号
   * @param toList コピー先のプレイリストの番号
   * @returns コピーしたら `true`
   */
  copyTrack(trackIndex: number, toList: number): boolean {
    const t = this.tracks[trackIndex];
    const to = this.lists[toList];
    if (!t || !to || toList === this.active || to.tracks.some((x) => x.path === t.path)) return false;
    to.tracks = [...to.tracks, t].slice(0, MAX_TRACKS);
    return true;
  }

  /**
   * 曲を、いま開いているプレイリストへ足す(すでにある曲は足さない。`MAX_TRACKS` まで)。
   * @param tracks 足す曲
   */
  add(tracks: MusicTrack[]) {
    const have = new Set(this.tracks.map((t) => t.path));
    this.tracks = [...this.tracks, ...tracks.filter((t) => !have.has(t.path))].slice(0, MAX_TRACKS);
    this.version++;
  }
  /**
   * 曲を、いま開いているプレイリストから消す。
   * @param i 曲の番号
   */
  removeAt(i: number) {
    this.tracks.splice(i, 1);
    this.version++;
  }
  /** いま開いているプレイリストの曲を、すべて消す。 */
  clearActive() {
    this.tracks = [];
    this.version++;
  }
  /**
   * 曲の並びを変える。
   * @param from 動かす曲の番号
   * @param to 動かす先の番号
   * @returns 動かしたら `true`(番号が範囲外・同じなら、何もしない)
   */
  move(from: number, to: number): boolean {
    const n = this.tracks.length;
    if (from < 0 || from >= n || to < 0 || to >= n || from === to) return false;
    const [m] = this.tracks.splice(from, 1);
    this.tracks.splice(to, 0, m);
    this.version++;
    return true;
  }
}
