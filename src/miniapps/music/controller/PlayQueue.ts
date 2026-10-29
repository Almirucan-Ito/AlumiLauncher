import { type Repeat } from "./PlayerModel";

/** 「前の曲」へ戻るための履歴の長さの上限。 */
const HISTORY_MAX = 200;

/** シャッフル時などに、「前の曲」へ戻るための、聴いた曲の番号の履歴(最大 200 件。長く聴き続けても、増え続けない)。 */
export class PlayHistory {
  private list: number[] = [];
  /** 曲の番号を足す。 */
  push(i: number) {
    this.list.push(i);
    if (this.list.length > HISTORY_MAX) this.list.shift();
  }
  /** 直前に聴いた曲の番号を取り出す(無ければ `undefined`)。 */
  pop(): number | undefined {
    return this.list.pop();
  }
  /** 履歴を空にする。 */
  clear() {
    this.list = [];
  }
  /** 曲 `i` が消えたあと: その曲を履歴から除き、後ろの曲の番号を 1 つずらす。 */
  afterRemove(i: number) {
    this.list = this.list.filter((h) => h !== i).map((h) => (h > i ? h - 1 : h));
  }
}

/**
 * 次に再生する曲の番号を決める。シャッフル中は、いまの曲以外から無作為に選ぶ。
 * @param o `n` 曲の数(1 以上) / `index` いまの曲 / `shuffle` シャッフル中か / `repeat` 繰り返しの設定 / `auto` 曲が終わって自動で進むときは `true`
 * @returns 次の曲の番号。自動で最後まで来て、繰り返しが「全曲」でないときは `null`(止まって、先頭に戻る)。手動なら、最後から先頭へ回る
 */
export function nextIndex(o: {
  n: number;
  index: number;
  shuffle: boolean;
  repeat: Repeat;
  auto: boolean;
}): number | null {
  const { n, index, shuffle, repeat, auto } = o;
  if (shuffle && n > 1) {
    let to: number;
    do to = Math.floor(Math.random() * n);
    while (to === index);
    return to;
  }
  const to = index + 1;
  if (to < n) return to;
  return repeat === "all" || !auto ? 0 : null;
}
