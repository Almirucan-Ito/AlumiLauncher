import { useEffect, useState } from "react";
import { api, fallbackIcon, type Item } from "../../shared/api/ApiModel";

// 最近使った順に最大 MAX_CACHED 個だけ保持する(大量のアイコンを開いてもメモリが増え続けないように)
/** アイコンを覚えておく数の上限。最近使った順に残し、超えたら古いものから捨てる(大量のアイコンを開いても、メモリが増え続けないように)。 */
const MAX_CACHED = 160;
/** 取得済みのアイコン(パス → 画像の data URI)。Map は挿入順なので、使うたびに入れ直して「最近使った順」にする。 */
const cache = new Map<string, string>();
/** 取得中のアイコン(パス → 取得の約束)。同じアイコンを同時に何度も頼まないため。 */
const pending = new Map<string, Promise<string>>();
/** アイコンの取り直しを知らせてほしい部品の一覧(`retryMissingIcons` / `resetIcons` で呼ぶ)。 */
const listeners = new Set<() => void>();

/**
 * 覚えているアイコンを取り出す(取り出したものは「最近使った」にする)。
 * @param path ファイルのパス
 * @returns 画像の data URI。覚えていなければ `undefined`
 */
function cacheGet(path: string): string | undefined {
  const v = cache.get(path);
  if (v !== undefined) {
    cache.delete(path); // Map は挿入順なので、入れ直して「最近使った」にする
    cache.set(path, v);
  }
  return v;
}

/**
 * アイコンを覚える。上限(`MAX_CACHED`)を超えたら、いちばん古いものを捨てる。
 * @param path ファイルのパス
 * @param src 画像の data URI
 */
function cacheSet(path: string, src: string) {
  cache.set(path, src);
  if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value as string);
}

/**
 * アイコンを取得する(覚えていればそれを返し、取得中なら同じ約束を返す)。
 * 失敗したときは、仮のアイコン(`fallbackIcon`)を返すだけで、覚えない(次に表示するとき・取り直したときに、もう一度取得する)。
 * @param item アイコンの対象
 * @returns 画像の data URI
 */
function loadIcon(item: Item): Promise<string> {
  const hit = cacheGet(item.path);
  if (hit) return Promise.resolve(hit);
  let p = pending.get(item.path);
  if (!p) {
    // 失敗時はフォールバックを表示するだけでキャッシュしない(次回表示・リロードで再取得する)
    p = api
      .getIcon(item)
      .then((src) => {
        cacheSet(item.path, src);
        return src;
      })
      .catch(() => fallbackIcon(item.name))
      .finally(() => pending.delete(item.path));
    pending.set(item.path, p);
  }
  return p;
}

/** 取得に失敗して仮アイコンになっているものだけ、取り直させる(取得済みのアイコンは取り直さない) */
export function retryMissingIcons() {
  listeners.forEach((f) => f());
}

/** アイコンと一覧のキャッシュを破棄し、表示中のアイコンを取り直させる */
export function resetIcons() {
  cache.clear();
  pending.clear();
  itemsCache.clear();
  listeners.forEach((f) => f());
}

/**
 * 画面の部品から、ファイルのアイコンを使う(取得が終わると、描き直される)。覚えていればすぐ返し、無ければ取得する。
 * @param item アイコンの対象
 * @returns 画像の data URI。取得中は `undefined`
 */
export function useIcon(item: Item): string | undefined {
  // 呼ぶ側が、毎回、項目の入れ物を作り直すことがあるので、中身(名前とパス)だけを依存にする
  const { path, name } = item;
  const [src, setSrc] = useState(() => cacheGet(path));
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const f = () => setTick((t) => t + 1);
    listeners.add(f);
    return () => {
      listeners.delete(f);
    };
  }, []);

  useEffect(() => {
    let live = true;
    const hit = cacheGet(path);
    if (hit) setSrc(hit);
    else {
      setSrc(undefined);
      loadIcon({ path, name }).then((s) => live && setSrc(s));
    }
    return () => {
      live = false;
    };
  }, [path, name, tick]);
  return src;
}

// フォルダ一覧もキャッシュして、開く時に待たせない
/** フォルダの中身の一覧を覚えておく(フォルダを開くときに待たせない)。 */
const itemsCache = new Map<string, Item[]>();
/**
 * 覚えているフォルダの中身を返す。
 * @param path フォルダのパス
 * @returns 一覧。覚えていなければ `undefined`
 */
export function cachedItems(path: string) {
  return itemsCache.get(path);
}
/** 取得中のフォルダの一覧の数(`whenIconsSettled` が、何も動いていないかを判断するのに使う)。 */
let listsInFlight = 0;
/**
 * フォルダの中身の一覧を取得して、覚える。フォルダを登録した直後は、設定の保存より先に一覧の要求が届くことがあるので、失敗したら 1 回だけやり直す。
 * @param path フォルダのパス
 * @returns アイコンの一覧
 */
export async function fetchItems(path: string): Promise<Item[]> {
  listsInFlight++;
  try {
    let items: Item[];
    try {
      items = await api.listItems(path);
    } catch {
      // フォルダを登録した直後は、設定の保存より先に一覧の要求が届くことがあるため一度だけ再試行する
      await new Promise((r) => setTimeout(r, 300));
      items = await api.listItems(path);
    }
    itemsCache.set(path, items);
    return items;
  } finally {
    listsInFlight--;
  }
}

/** 一覧とアイコンの取得が、しばらく何も動いていない状態になるまで待つ(最長 maxMs)。起動時に、アイコンが揃ってから画面を出すために使う */
export function whenIconsSettled(maxMs: number): Promise<void> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    let quiet = 0;
    const tick = () => {
      quiet = pending.size === 0 && listsInFlight === 0 ? quiet + 1 : 0;
      if (quiet >= 4 || performance.now() - t0 > maxMs) return resolve();
      setTimeout(tick, 60);
    };
    setTimeout(tick, 60);
  });
}
