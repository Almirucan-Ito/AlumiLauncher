import { useEffect, useRef, useState } from "react";
import type { StorageKind } from "../api/ApiModel";
import { t } from "../i18n/i18n";

/** ウィジェット・ミニアプリごとの、データ・キャッシュの大きさ(バイト)。キーは `"種類:フォルダ名"`。 */
export type StorageMap = Record<string, { data: number; cache: number }>;

/**
 * バイト数を、読みやすい文字列にする(B / KB / MB)。
 * @param n バイト数
 * @returns `"512 B"` / `"3.4 KB"` / `"12.0 MB"` のような文字列
 */
const fmtBytes = (n: number) =>
  n < 1024
    ? `${n} B`
    : n < 1024 * 1024
      ? `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`
      : `${(n / 1048576).toFixed(1)} MB`;

/**
 * 誤って消さないように、2 回押すと実行するボタンの状態(フック)。1 回目の押下から 3 秒だけ、「もう一度」の状態になる。
 * @returns `armed`(確認待ちか)/ `press(run)`(1 回目は準備、2 回目で `run` を実行する)
 */
function useTwoStep() {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number>();
  useEffect(() => () => clearTimeout(timer.current), []);
  /** 1 回目は準備、2 回目で run を実行する */
  const press = (run: () => void) => {
    if (armed) {
      clearTimeout(timer.current);
      setArmed(false);
      run();
    } else {
      setArmed(true);
      timer.current = window.setTimeout(() => setArmed(false), 3000);
    }
  };
  return { armed, press };
}

/**
 * 1 つのウィジェット・ミニアプリの、データとキャッシュの大きさと、消去ボタン(データの消去は、2 回押す)。
 * @param usage データ・キャッシュの大きさ(無ければ 0)
 * @param onClear 消去が押されたとき(`"data"` か `"cache"`)
 */
export function StorageLine({
  usage,
  onClear,
}: {
  usage?: { data: number; cache: number };
  onClear: (what: "data" | "cache") => void;
}) {
  const data = usage?.data ?? 0;
  const cache = usage?.cache ?? 0;
  const two = useTwoStep();
  return (
    <div className="wstore">
      <span>
        {t("dataLabel")} {fmtBytes(data)}
      </span>
      <button className="small ghost-btn" disabled={data === 0} onClick={() => two.press(() => onClear("data"))}>
        {two.armed ? t("clearSure") : t("clearBtn")}
      </button>
      <span>
        {t("cacheLabel")} {fmtBytes(cache)}
      </span>
      <button className="small ghost-btn" disabled={cache === 0} onClick={() => onClear("cache")}>
        {t("clearBtn")}
      </button>
    </div>
  );
}

/**
 * 一覧の下の、「すべてのキャッシュを消去」「すべてのデータを消去」ボタン(データは、2 回押す)。
 * @param onClearAll 押されたとき(`"data"` か `"cache"`)
 */
export function ClearAllButtons({ onClearAll }: { onClearAll: (what: "data" | "cache") => void }) {
  const two = useTwoStep();
  return (
    <>
      <button className="small ghost-btn" onClick={() => onClearAll("cache")}>
        {t("clearAllCache")}
      </button>
      <button className="small ghost-btn" onClick={() => two.press(() => onClearAll("data"))}>
        {two.armed ? t("clearSure") : t("clearAllData")}
      </button>
    </>
  );
}

/** データ・キャッシュを扱う対象(種類とフォルダ名)。 */
export type StorageTarget = { kind: StorageKind; id: string };
/**
 * `StorageMap` のキーを作る。
 * @param tg 対象
 * @returns `"種類:フォルダ名"`
 */
export const storageKey = (tg: StorageTarget) => `${tg.kind}:${tg.id}`;
