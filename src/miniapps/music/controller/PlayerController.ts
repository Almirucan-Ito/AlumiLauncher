import { clamp01 } from "../../../launcher/shared/lib/MathUtil";
import { useSyncExternalStore } from "react";
import { ExternalStore } from "../../../launcher/shared/lib/ExternalStore";
import { type MusicTrack } from "../../../launcher/shared/api/ApiModel";
import { bindMediaKeys, showMediaTitle } from "./MediaSessionBridge";
import { type PlayerState, type Repeat } from "./PlayerModel";
import { PlayHistory, nextIndex } from "./PlayQueue";
import { Persister, buildEntries, defaultSettings, restoreState } from "./PlayerStore";
import { Playlists } from "./Playlists";
import { SleepTimer } from "./SleepTimer";

// 型は、これまでどおり、ここから読み込める
export type { PlayerState, Repeat } from "./PlayerModel";

/**
 * 音楽プレーヤー。HTML の Audio 1 つで再生し、プレイリスト(最大 9 個。先頭 0 番は、お気に入りの「マイリスト」。一覧の操作は `Playlists`)・音量・シャッフル・繰り返し・速度・おやすみタイマー・Windows のメディアキー対応を持つ。
 * 状態は `getState()` の写し(`PlayerState`)で外へ渡し、変わるたびに購読者へ知らせる(`subscribe`)。設定とプレイリストは、少し待ってまとめて保存する(`setPersist` で渡された関数へ。中身は `PlayerStore`)。
 */
class PlayerController extends ExternalStore<PlayerState> {
  private audio = new Audio();
  /** プレイリストの集まり。いま開いているものが、再生の対象(曲の一覧) */
  private pl = new Playlists();
  private get tracks(): MusicTrack[] {
    return this.pl.tracks;
  }
  private index = -1;
  /** 保存する設定(音量・ミュート・シャッフル・繰り返し・速度) */
  private st = defaultSettings();
  /** ランチャー全体の音量(設定の「音量」。保存しない) */
  private master = 1;
  private sleep = new SleepTimer();
  private history = new PlayHistory(); // シャッフル時に、「前の曲」へ戻るための履歴
  /** 続けて読み込めなかった曲の数(再生が始まったら 0 に戻す。全部の曲が読み込めないとき、次の曲へ進み続けないための歯止め)。 */
  private errorStreak = 0;
  private persister = new Persister();

  /** Audio の各イベント(再生・一時停止・時間の更新・曲の終わり・読み込みエラー)を、状態の更新へつなぐ。 */
  constructor() {
    super();
    this.audio.preload = "metadata";
    for (const ev of ["play", "pause", "timeupdate", "durationchange", "loadedmetadata", "ratechange"]) {
      this.audio.addEventListener(ev, () => this.emit());
    }
    this.audio.addEventListener("ended", () => this.onEnded());
    this.audio.addEventListener("playing", () => (this.errorStreak = 0));
    this.audio.addEventListener("error", () => {
      // 読み込めない曲(消された・形式が違うなど)は、飛ばす。ただし、全部の曲が続けて読み込めなかったら(全部消されたときなど)、止める
      // (止めないと、次の曲へ進み続けて、終わらなくなる)
      this.errorStreak++;
      if (this.index >= 0 && this.tracks.length > 1 && this.errorStreak < this.tracks.length) this.next(true);
      else {
        this.errorStreak = 0;
        this.emit();
      }
    });
    this.init();
    // Windows のメディアキー・音量オーバーレイから、再生・一時停止・前の曲・次の曲を操作できるようにする(使えない環境では、何もしない)
    bindMediaKeys({
      play: () => this.play(),
      pause: () => this.pause(),
      prev: () => this.prev(),
      next: () => this.next(),
    });
  }

  // ---- 状態 ----
  /**
   * いまの状態から、外へ渡す写し(`PlayerState`)を作る。
   * @returns 状態の写し
   */
  protected compute(): PlayerState {
    return {
      count: this.tracks.length,
      index: this.index,
      title: this.tracks[this.index]?.name ?? "",
      playing: !this.audio.paused && !this.audio.ended && this.index >= 0,
      position: Number.isFinite(this.audio.currentTime) ? this.audio.currentTime : 0,
      duration: Number.isFinite(this.audio.duration) ? this.audio.duration : 0,
      volume: this.st.volume,
      muted: this.st.muted,
      shuffle: this.st.shuffle,
      repeat: this.st.repeat,
      rate: this.st.rate,
      sleepLeft: this.sleep.left(),
      tracksVersion: this.pl.version,
      lists: this.pl.names,
      activeList: this.pl.active,
      fav: this.index >= 0 && this.pl.isFavorite(this.tracks[this.index]?.path),
    };
  }
  /**
   * いまのプレイリストの曲の情報(ミニアプリへ送る用)。
   * @returns `n`(曲名)と `f`(マイリストに入っているか)の一覧
   */
  trackInfo = () => this.tracks.map((t) => ({ n: t.name, f: this.pl.isFavorite(t.path) }));

  // ---- 保存 ----
  /** 設定が変わったときに、保存する内容(キーと文字列の組)を渡してもらう先を決める。 @param fn 保存する内容を受け取る関数 */
  setPersist(fn: (entries: Record<string, string>) => void) {
    this.persister.setTarget(fn);
  }
  /** 設定・一覧が変わったあとの共通の処理(保存の予約と、状態の通知)。 */
  private commit() {
    this.schedulePersist();
    this.emit();
  }
  /** 保存を予約する(400ms まとめる)。内容は `buildEntries`(設定・プレイリストの名前・曲のパスを、`music` / `music_fav` / `music_p0`〜 に分ける)で作り、1 回で渡す。 */
  private schedulePersist() {
    this.persister.schedule(() =>
      buildEntries({ lists: this.pl.lists, active: this.pl.active, index: this.index, ...this.st }),
    );
  }
  /**
   * 前回のプレイリストと設定を戻す(音声ファイルは登録し直す。消えたものは除かれる)。曲は、選んでおくだけで、勝手に鳴らさない。
   * すでに曲があるときや、保存が壊れているときは、何もしない。
   * @param read 保存した項目を読む関数(キー → 文字列。無ければ `undefined`)
   */
  async restore(read: (key: string) => string | undefined) {
    if (!read("music") || this.pl.lists.some((l) => l.tracks.length > 0)) return;
    try {
      const r = await restoreState(read);
      if (r) {
        Object.assign(this.st, r.settings);
        this.audio.playbackRate = this.st.rate;
        this.applyVolume();
        if (!this.pl.lists.some((l) => l.tracks.length > 0)) {
          this.pl.replace(r.lists, r.active);
          const n = this.tracks.length;
          // 曲は選んでおくだけ(勝手に鳴らさない)
          if (n > 0) this.select(r.index !== undefined && r.index >= 0 && r.index < n ? r.index : 0, false);
        }
      }
    } catch {
      /* 壊れた保存データは、無かったことにする */
    }
    this.emit();
  }

  /** データを消したときなど: 曲の一覧・設定を、最初の状態に戻す(保存はしない)。 */
  reset() {
    this.persister.cancel();
    this.resetPlayback();
    this.pl.reset();
    this.st = defaultSettings();
    this.audio.playbackRate = 1;
    this.applyVolume();
    this.emit();
  }

  // ---- プレイリスト(一覧の操作は `Playlists`。ここでは、再生・保存・通知を合わせる) ----
  /** 再生を止めて、曲の選択と履歴を空にする(Audio の読み込みも解く)。 */
  private resetPlayback() {
    this.history.clear();
    this.index = -1;
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
  }
  /** プレイリストを新しく作って、それを開く。上限(`MAX_LISTS`)なら何もしない。 @param name 名前(30 字まで。省くと、「プレイリスト N」) */
  newList(name?: string) {
    if (this.pl.create(name)) this.selectList(this.pl.lists.length - 1);
  }
  /**
   * プレイリストの名前を変える。マイリスト(0 番)は変えられない。
   * @param i プレイリストの番号
   * @param name 新しい名前(30 字まで。空は無視)
   */
  renameList(i: number, name: string) {
    if (this.pl.rename(i, name)) this.afterListsChange();
  }
  /** プレイリストを消す。マイリストは消せない。自分のプレイリストが 1 つだけのときは、消さずに中身を空にする。 @param i プレイリストの番号 */
  deleteList(i: number) {
    const r = this.pl.delete(i);
    if (!r) return;
    if (r.reset) this.resetPlayback();
    if (r.reselect && this.tracks.length > 0) this.select(0, false);
    this.afterListsChange();
  }
  /** プレイリストが変わったあとの共通の処理(保存の予約と、状態の通知)。 */
  private afterListsChange() {
    this.commit();
  }
  /** 開くプレイリストを切り替える(再生は止まり、先頭の曲を選んでおく)。 @param i プレイリストの番号 */
  selectList(i: number) {
    if (!this.pl.lists[i] || i === this.pl.active) return this.emit();
    this.pl.active = i;
    this.resetPlayback();
    this.pl.version++;
    if (this.tracks.length > 0) this.select(0, false);
    this.afterListsChange();
  }
  /** 曲をマイリストに入れる/外す。マイリストを開いているときに外すと、一覧からも消える。 @param i 曲の番号。省くと、いま選んでいる曲 */
  toggleFavorite(i?: number) {
    const idx = i ?? this.index;
    const r = this.pl.toggleFavorite(idx);
    if (r === "remove") this.remove(idx);
    else if (r === "toggled") this.afterListsChange();
  }
  /**
   * いまのプレイリストの曲を、別のプレイリストへコピーする(同じ曲がすでにあれば、何もしない)。
   * @param trackIndex 曲の番号
   * @param toList コピー先のプレイリストの番号
   */
  copyTrack(trackIndex: number, toList: number) {
    if (this.pl.copyTrack(trackIndex, toList)) this.afterListsChange();
  }

  // ---- 音量 ----
  /** Audio の音量を決める(プレーヤーの音量 × ランチャー全体の音量。ミュート中は 0)。 */
  private applyVolume() {
    this.audio.volume = this.st.muted ? 0 : clamp01(this.st.volume * this.master);
  }
  /** ランチャー全体の音量を決める(設定の「音量」)。 @param v 0〜1 */
  setMaster(v: number) {
    this.master = clamp01(v);
    this.applyVolume();
    this.emit();
  }
  /** プレーヤーの音量を決める(0 より大きくすると、ミュートを解く)。 @param v 0〜1 */
  setVolume(v: number) {
    this.st.volume = clamp01(v);
    if (this.st.volume > 0) this.st.muted = false;
    this.applyVolume();
    this.commit();
  }
  /** ミュートの切り替え。 @param m ミュートするか */
  setMuted(m: boolean) {
    this.st.muted = m;
    this.applyVolume();
    this.commit();
  }

  // ---- 曲の一覧 ----
  /** 曲を、いまのプレイリストへ足す(すでにある曲は足さない。3000 曲まで)。空だったときは、先頭の曲を選んでおく。 @param tracks 足す曲 */
  add(tracks: MusicTrack[]) {
    if (tracks.length === 0) return;
    const wasEmpty = this.tracks.length === 0;
    this.pl.add(tracks);
    if (wasEmpty) this.select(0, false);
    this.commit();
  }
  /** 曲を消す。再生中の曲を消したら、次の曲へ(再生中だったときは、そのまま再生)。履歴の番号もずらす。 @param i 曲の番号 */
  remove(i: number) {
    if (i < 0 || i >= this.tracks.length) return;
    const playing = i === this.index;
    const wasPlaying = !this.audio.paused;
    this.pl.removeAt(i);
    this.history.afterRemove(i);
    if (this.tracks.length === 0) {
      this.index = -1;
      this.audio.pause();
      this.audio.removeAttribute("src");
      this.audio.load();
    } else if (playing) {
      this.select(Math.min(i, this.tracks.length - 1), wasPlaying);
    } else if (i < this.index) {
      this.index--;
    }
    this.commit();
  }
  /** いまのプレイリストの曲を、すべて消す(再生も止まる)。 */
  clear() {
    this.pl.clearActive();
    this.resetPlayback();
    this.commit();
  }
  /**
   * 曲の並びを変える(いま選んでいる曲は、選んだまま)。
   * @param from 動かす曲の番号
   * @param to 動かす先の番号
   */
  move(from: number, to: number) {
    const cur = this.tracks[this.index];
    if (!this.pl.move(from, to)) return;
    this.index = cur ? this.tracks.indexOf(cur) : -1;
    this.history.clear();
    this.commit();
  }

  // ---- 再生 ----
  /**
   * 曲を選んで、Audio に読み込ませる。
   * @param i 曲の番号
   * @param autoplay 読み込んだら、すぐ再生するか
   */
  private select(i: number, autoplay: boolean) {
    const t = this.tracks[i];
    if (!t) return;
    this.index = i;
    this.audio.src = t.url;
    this.audio.playbackRate = this.st.rate;
    this.applyVolume();
    showMediaTitle(this.tracks[i]?.name ?? ""); // メディアキー・音量オーバーレイに出す曲名
    if (autoplay) void this.audio.play().catch(() => this.emit());
    this.commit();
  }
  /** 再生する。 @param i 曲の番号。省くと、いまの曲の続き(曲が選ばれていなければ、先頭から) */
  play(i?: number) {
    if (i !== undefined) {
      if (this.index >= 0 && i !== this.index) this.history.push(this.index);
      this.select(i, true);
    } else if (this.index >= 0) {
      void this.audio.play().catch(() => this.emit());
    } else if (this.tracks.length > 0) {
      this.select(0, true);
    }
  }
  /** 一時停止する。 */
  pause() {
    this.audio.pause();
  }
  /** 再生/一時停止を切り替える。 */
  toggle() {
    if (this.audio.paused) this.play();
    else this.pause();
  }
  /** 再生位置を動かす(曲の長さを超えないように収める)。 @param sec 位置(秒) */
  seek(sec: number) {
    if (this.index < 0) return;
    this.audio.currentTime = Math.max(
      0,
      Math.min(Number.isFinite(this.audio.duration) ? this.audio.duration : sec, sec),
    );
    this.emit();
  }
  /** 次の曲へ進む。シャッフル中は、いまの曲以外から無作為に選ぶ。 @param auto 曲が終わって自動で進むときは `true`(最後まで来たら、繰り返しが「全曲」でなければ、止まって先頭に戻る)。手動なら、最後から先頭へ回る */
  next(auto = false) {
    const n = this.tracks.length;
    if (n === 0) return;
    const to = nextIndex({ n, index: this.index, shuffle: this.st.shuffle, repeat: this.st.repeat, auto });
    if (to === null) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.emit();
      return;
    }
    if (this.index >= 0) this.history.push(this.index);
    this.select(to, true);
  }
  /** 前の曲へ戻る。3 秒以上進んでいたら、曲の頭に戻る。履歴があれば、直前に聴いた曲へ(シャッフル対応)。 */
  prev() {
    if (this.tracks.length === 0) return;
    if (this.audio.currentTime > 3) return this.seek(0);
    let to = this.history.pop();
    if (to === undefined) to = this.index <= 0 ? this.tracks.length - 1 : this.index - 1;
    this.select(to, true);
  }
  /** 曲が終わったとき。「1 曲」の繰り返しなら、同じ曲をもう一度。そうでなければ、次の曲へ。 */
  private onEnded() {
    if (this.st.repeat === "one") {
      this.audio.currentTime = 0;
      void this.audio.play();
    } else this.next(true);
  }
  /** シャッフルのオン/オフ。 @param on オンにするか */
  setShuffle(on: boolean) {
    this.st.shuffle = on;
    this.commit();
  }
  /** 繰り返しの設定。 @param r `"off"` / `"all"` / `"one"` */
  setRepeat(r: Repeat) {
    this.st.repeat = r;
    this.commit();
  }
  /** 再生速度を決める(0.5〜2 倍に収める)。 @param r 倍率 */
  setRate(r: number) {
    this.st.rate = Math.min(2, Math.max(0.5, r));
    this.audio.playbackRate = this.st.rate;
    this.commit();
  }
  /** おやすみタイマー(指定した時間がたつと、一時停止する)。 @param min 分。0 または `null` で解除 */
  setSleep(min: number | null) {
    this.sleep.set(min, () => {
      this.pause();
      this.emit();
    });
    this.emit();
  }
}

/** アプリ全体で 1 つだけ使う、音楽プレーヤー。 */
export const player = new PlayerController();

/** 画面の部品から、プレーヤーの状態を使う(変わるたびに描き直される)。 */
export const usePlayer = () => useSyncExternalStore(player.subscribe, player.getState);
