import { useEffect, useSyncExternalStore } from "react";
import { api, type StorageKind } from "./ApiModel";

/** 書き込みを、まとめてからファイルへ書くまでの待ち時間(ミリ秒)。 */
const WRITE_DELAY_MS = 300;
/** まだ読み込んでいないときに返す、空のデータ(毎回新しい空の表を作らないための、共有の値)。 */
const EMPTY: Record<string, string> = {};

/**
 * ウィジェット・ミニアプリのデータの管理。データは、それぞれのフォルダの中の `data` フォルダに、キーごとのファイルで保存される。
 * 画面では、読み込んだ内容を覚えておいて(同期で読める)、書き込みは、キーごとに少しまとめてからファイルへ書く(`WRITE_DELAY_MS`)。
 * ウィンドウを隠す・閉じるときは、書き込み待ちを、すぐ書く。
 */
class AppDataModel {
  private maps = new Map<string, Record<string, string>>();
  private loading = new Map<string, Promise<Record<string, string>>>();
  private timers = new Map<string, number>();
  private pending = new Map<string, { kind: StorageKind; id: string; key: string; value: string }>();
  private listeners = new Set<() => void>();
  private version = 0;

  /** ウィンドウを隠す・閉じるときに、書き込み待ちをすぐ書くよう、イベントを登録する。 */
  constructor() {
    // ウィンドウを隠す・閉じるときに、書き込み待ちを、すぐ書く
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => document.hidden && this.flushAll());
      window.addEventListener("pagehide", () => this.flushAll());
    }
  }

  /** 管理用のキー(`<種類>:<フォルダ名>`)を作る。 */
  private k = (kind: StorageKind, id: string) => `${kind}:${id}`;
  /** 内容が変わったことを、画面の部品へ知らせる(版番号を進めて、購読している部品を描き直させる)。 */
  private bump() {
    this.version++;
    this.listeners.forEach((f) => f());
  }
  /**
   * 内容の変化を購読する(`useSyncExternalStore` 用)。
   * @param f 変化したときに呼ばれる関数
   * @returns 購読を解除する関数
   */
  subscribe = (f: () => void) => {
    this.listeners.add(f);
    return () => this.listeners.delete(f);
  };
  /** いまの版番号を返す(`useSyncExternalStore` 用。変わったら描き直す)。 */
  getVersion = () => this.version;

  /**
   * データを読み込む。1 回だけ読み、読み込み中に書かれたものは残す(読み込んだ内容より優先)。
   * @param kind `"widget"` か `"miniapp"`
   * @param id フォルダ名
   * @returns キー → 値の表(読み込みに失敗したら空)
   */
  load(kind: StorageKind, id: string): Promise<Record<string, string>> {
    const k = this.k(kind, id);
    let p = this.loading.get(k);
    if (!p) {
      p = api
        .appDataLoad(kind, id)
        .catch(() => ({}) as Record<string, string>)
        .then((loaded) => {
          this.maps.set(k, { ...loaded, ...(this.maps.get(k) ?? {}) });
          this.bump();
          return this.maps.get(k)!;
        });
      this.loading.set(k, p);
    }
    return p;
  }
  /**
   * 読み込み済みのデータを返す(まだなら空)。
   * @param kind 種類
   * @param id フォルダ名
   */
  map(kind: StorageKind, id: string): Record<string, string> {
    return this.maps.get(this.k(kind, id)) ?? EMPTY;
  }
  /**
   * データを 1 つ読む(必要なら、読み込みを待つ)。
   * @param key キー名
   * @returns 値。無ければ `undefined`
   */
  async read(kind: StorageKind, id: string, key: string): Promise<string | undefined> {
    return (await this.load(kind, id))[key];
  }
  /**
   * データを 1 つ書く。覚えている内容はすぐ変え、ファイルへの書き込みは、少し待ってまとめる。
   * @param kind 種類
   * @param id フォルダ名
   * @param key キー名
   * @param value 値(64KB まで)
   */
  set(kind: StorageKind, id: string, key: string, value: string) {
    const k = this.k(kind, id);
    this.maps.set(k, { ...(this.maps.get(k) ?? {}), [key]: value });
    this.bump();
    const pk = `${k}/${key}`;
    this.pending.set(pk, { kind, id, key, value });
    clearTimeout(this.timers.get(pk));
    this.timers.set(
      pk,
      window.setTimeout(() => this.flush(pk), WRITE_DELAY_MS),
    );
  }
  /**
   * 書き込み待ちの 1 件を、ファイルへ書く。
   * @param pk 書き込み待ちのキー(`<種類>:<フォルダ名>/<キー>`)
   */
  private flush(pk: string) {
    clearTimeout(this.timers.get(pk));
    this.timers.delete(pk);
    const p = this.pending.get(pk);
    if (!p) return;
    this.pending.delete(pk);
    api.appDataSet(p.kind, p.id, p.key, p.value).catch(() => {});
  }
  /** 書き込み待ちを、すべて、すぐ書く。 */
  flushAll() {
    for (const pk of [...this.pending.keys()]) this.flush(pk);
  }
  /**
   * 消去したあとなど: 覚えている内容と、書き込み待ちを捨てる。
   * @param kind 種類。省くと、すべて
   * @param id フォルダ名。省くと、その種類のすべて
   */
  reset(kind?: StorageKind, id?: string) {
    const match = (k: string) =>
      kind === undefined ? true : k === this.k(kind, id ?? "") || (id === undefined && k.startsWith(`${kind}:`));
    for (const k of [...this.maps.keys()]) if (match(k)) this.maps.delete(k);
    for (const k of [...this.loading.keys()]) if (match(k)) this.loading.delete(k);
    for (const [pk, p] of [...this.pending]) {
      if (match(this.k(p.kind, p.id))) {
        clearTimeout(this.timers.get(pk));
        this.timers.delete(pk);
        this.pending.delete(pk);
      }
    }
    this.bump();
  }
}

/** アプリ全体で 1 つだけ使う、データの管理。 */
export const appData = new AppDataModel();

/**
 * 画面の部品から、そのウィジェット・ミニアプリのデータを使う(読み込みが終わると、描き直される)。
 * @param kind 種類
 * @param id フォルダ名
 * @returns キー → 値の表
 */
export function useAppData(kind: StorageKind, id: string): Record<string, string> {
  useSyncExternalStore(appData.subscribe, appData.getVersion);
  useEffect(() => {
    void appData.load(kind, id);
  }, [kind, id]);
  return appData.map(kind, id);
}
