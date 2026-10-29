/**
 * アラーム 1 件(ミニアプリが頼む、時刻の知らせ)。
 * `at` 知らせる時刻(UNIX ミリ秒)/ `label` 知らせるときの文言 / `kind` 使い道の種類(`timer` / `focus` / `break` など。ミニアプリが自由に決める)/ `minutes` 何分のアラームか(記録用)
 */
export interface Alarm {
  id: string;
  /** 知らせる時刻(UNIX ミリ秒) */
  at: number;
  label: string;
  /** 使い道の種類(例: "timer" / "focus" / "break")。ミニアプリが自由に決める */
  kind: string;
  /** 何分のアラームか(記録用) */
  minutes: number;
}
/** 知らせ済みのアラーム。`firedAt` は実際に知らせた時刻、`app` は頼んだミニアプリのフォルダ名。 */
export interface Fired extends Alarm {
  firedAt: number;
  /** 頼んだミニアプリのフォルダ名 */
  app: string;
}
/** 管理しているアラーム(頼んだミニアプリの名前つき)。 */
type Entry = Alarm & { app: string };

/** 同時に持てるアラームの数の上限(超えたら古いものから捨てる)。 */
const MAX_ALARMS = 20;
/** 知らせ済みの記録の上限。 */
const MAX_DONE = 100;

/**
 * アラームの管理。ミニアプリ「時計とタイマー」などが頼む、時刻の知らせを預かる。
 * ランチャー本体(画面側)が持つので、ミニアプリを閉じていても、時刻になれば、音と画面で知らせる。知らせた記録(done)は、ミニアプリが次に開いたときに受け取れる。
 * アラームは、頼んだミニアプリごとに分けて持ち、そのミニアプリのフォルダの data(`_alarms`)に保存する。
 */
class AlarmController {
  private list: Entry[] = [];
  private done: Fired[] = [];
  private timers = new Map<string, number>();
  private listeners = new Set<(a: Fired) => void>();
  private persist: ((app: string, json: string) => void) | null = null;
  private onFire: ((a: Fired) => void) | null = null;

  /**
   * 保存の窓口(ミニアプリごと)と、時刻になったときの知らせ方(音・画面)を決める。
   * @param persist ミニアプリ名と、保存する JSON 文字列を受け取る関数
   * @param onFire 時刻になったとき、知らせる処理
   */
  configure(persist: (app: string, json: string) => void, onFire: (a: Fired) => void) {
    this.persist = persist;
    this.onFire = onFire;
  }
  /**
   * ミニアプリが開いている間、時刻になったことを教えてもらう。
   * @param f 時刻になったときに呼ばれる関数
   * @returns 登録を解除する関数
   */
  subscribe(f: (a: Fired) => void) {
    this.listeners.add(f);
    return () => this.listeners.delete(f);
  }

  /**
   * 前回の保存を戻す。すでに過ぎているもの(アプリを閉じている間に過ぎたもの)は、知らせずに記録(done)へ移す。同じミニアプリは 1 回しか戻さない。
   * @param app ミニアプリのフォルダ名
   * @param json 保存してあった JSON(無い・壊れているときは、何もしない)
   */
  restore(app: string, json: string | undefined) {
    if (!json || this.list.some((x) => x.app === app) || this.done.some((x) => x.app === app)) return;
    try {
      const s = JSON.parse(json) as { alarms?: Alarm[]; done?: Fired[] };
      const ok = (a: unknown): a is Alarm =>
        !!a && typeof (a as Alarm).id === "string" && typeof (a as Alarm).at === "number";
      this.done.push(
        ...(Array.isArray(s.done) ? s.done.filter(ok) : []).slice(-MAX_DONE).map((d) => ({ ...(d as Fired), app })),
      );
      for (const a of (Array.isArray(s.alarms) ? s.alarms.filter(ok) : []).slice(0, MAX_ALARMS)) {
        if (a.at <= Date.now()) this.done.push({ ...a, app, firedAt: a.at });
        else this.add({ ...a, app });
      }
    } catch {
      /* 壊れた保存は、無かったことにする */
    }
    this.save(app);
  }

  /**
   * そのミニアプリのアラームと記録を、保存の窓口へ渡す。
   * @param app ミニアプリのフォルダ名
   */
  private save(app: string) {
    this.persist?.(
      app,
      JSON.stringify({
        alarms: this.list.filter((x) => x.app === app).map(({ app: _a, ...a }) => a),
        done: this.done.filter((x) => x.app === app),
      }),
    );
  }
  /** タイマーの管理に使うキー(`<ミニアプリ>/<アラーム ID>`)。 */
  private tk = (app: string, id: string) => `${app}/${id}`;
  /**
   * アラームを登録して、時刻になったら知らせるタイマーを仕掛ける。同じ ID があれば置き換える。
   * setTimeout の上限(約 24 日)を超えないように、長いものは、時々かけ直す。
   * @param a 登録するアラーム
   */
  private add(a: Entry) {
    const kept = [...this.list.filter((x) => !(x.app === a.app && x.id === a.id)), a];
    // 上限を超えて押し出された古いアラームは、タイマーも止める(止めないと、一覧にないのに、タイマーだけが残る)
    for (const dropped of kept.slice(0, Math.max(0, kept.length - MAX_ALARMS)))
      clearTimeout(this.timers.get(this.tk(dropped.app, dropped.id)));
    this.list = kept.slice(-MAX_ALARMS);
    const k = this.tk(a.app, a.id);
    clearTimeout(this.timers.get(k));
    // setTimeout の上限(約 24 日)を超えないように、長いものは、時々かけ直す
    const arm = () => {
      const left = a.at - Date.now();
      if (left <= 0) return this.fire(a.app, a.id);
      this.timers.set(k, window.setTimeout(arm, Math.min(left, 2 ** 30)));
    };
    arm();
  }
  /**
   * (ミニアプリの頼み)アラームを登録する。ID が長すぎる・時刻が不正なものは、無視する。文言は 60 字、種類は 20 字まで。
   * @param app 頼んだミニアプリのフォルダ名
   * @param a アラーム
   */
  set(app: string, a: Alarm) {
    if (!a.id || a.id.length > 40 || !Number.isFinite(a.at)) return;
    this.add({
      app,
      id: a.id,
      at: a.at,
      label: String(a.label ?? "").slice(0, 60),
      kind: String(a.kind ?? "").slice(0, 20),
      minutes: Number(a.minutes) || 0,
    });
    this.save(app);
  }
  /**
   * (ミニアプリの頼み)アラームを取り消す。
   * @param app 頼んだミニアプリのフォルダ名
   * @param id アラーム ID
   */
  cancel(app: string, id: string) {
    const k = this.tk(app, id);
    clearTimeout(this.timers.get(k));
    this.timers.delete(k);
    this.list = this.list.filter((x) => !(x.app === app && x.id === id));
    this.save(app);
  }
  /**
   * 時刻になったアラームを知らせる。一覧から外して記録(done)へ移し、保存してから、音・画面(`onFire`)と、開いているミニアプリ(`listeners`)へ知らせる。
   * @param app ミニアプリのフォルダ名
   * @param id アラーム ID
   */
  private fire(app: string, id: string) {
    const a = this.list.find((x) => x.app === app && x.id === id);
    if (!a) return;
    this.timers.delete(this.tk(app, id));
    this.list = this.list.filter((x) => x !== a);
    const f: Fired = { ...a, firedAt: Date.now() };
    this.done = [...this.done, f].slice(-MAX_DONE);
    this.save(app);
    this.onFire?.(f);
    this.listeners.forEach((l) => l(f));
  }
  /** そのミニアプリの、まだ知らせていないアラームの一覧を返す。 */
  pending = (app: string) => this.list.filter((x) => x.app === app);
  /**
   * 知らせ済みの記録を受け取る(受け取ったものは消える)。ミニアプリが開いたときに、閉じている間に鳴ったものを知るために使う。
   * @param app ミニアプリのフォルダ名
   * @returns 知らせ済みのアラームの一覧
   */
  collect(app: string): Fired[] {
    const out = this.done.filter((x) => x.app === app);
    if (out.length === 0) return [];
    this.done = this.done.filter((x) => x.app !== app);
    this.save(app);
    return out;
  }
  /**
   * データを消したときなど: そのミニアプリのアラームと記録を、すべて捨てる(保存はしない)。
   * @param app ミニアプリのフォルダ名。省くと、すべてのミニアプリ
   */
  clear(app?: string) {
    for (const x of this.list.filter((e) => app === undefined || e.app === app))
      clearTimeout(this.timers.get(this.tk(x.app, x.id)));
    this.list = this.list.filter((e) => app !== undefined && e.app !== app);
    this.done = this.done.filter((e) => app !== undefined && e.app !== app);
  }
}

/** アプリ全体で 1 つだけ使う、アラームの管理。 */
export const alarms = new AlarmController();
