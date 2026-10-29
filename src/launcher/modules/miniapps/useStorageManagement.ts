import { useCallback, useState } from "react";
import { api } from "../../shared/api/ApiModel";
import { appData } from "../../shared/api/AppDataModel";
import { t } from "../../shared/i18n/i18n";
import { type StorageMap, type StorageTarget } from "../../shared/ui/storageui";
import { launcherHooks } from "../plugins/PluginRegistry";
import { alarms } from "./AlarmController";

/**
 * ウィジェット・ミニアプリごとの、データ・キャッシュの大きさの取得と、消去(一覧を開いたとき、消去したあとに読み直す)。
 * @param flash 画面に一言出す関数
 * @param closeMiniFor データを消したとき、開いているミニアプリを閉じるかを判断して閉じる関数(`tg` を省くと、すべて)
 * @returns 大きさ(`storage`)と、読み直し・消去の関数
 */
export function useStorageManagement({
  flash,
  closeMiniFor,
}: {
  flash: (msg: string) => void;
  closeMiniFor: (tg?: StorageTarget) => void;
}) {
  const [storage, setStorage] = useState<StorageMap>({});
  /** ウィジェット・ミニアプリごとの、データ・キャッシュの大きさを読み直す(一覧を開いたとき・消去したあと)。 */
  const refreshStorage = useCallback(
    () =>
      api
        .appStorageInfo()
        .then((l) =>
          setStorage(Object.fromEntries(l.map((u) => [`${u.kind}:${u.id}`, { data: u.data, cache: u.cache }]))),
        )
        .catch(() => {}),
    [],
  );
  /**
   * データを消したあと: 覚えている内容・アラーム・音楽プレーヤーを、消した内容に合わせる。開いているミニアプリは、閉じる。
   * @param tg 消した対象。省くと、すべて
   */
  const afterDataCleared = (tg?: StorageTarget) => {
    appData.reset(tg?.kind, tg?.id);
    if (!tg || tg.kind === "miniapp") alarms.clear(tg?.id);
    launcherHooks.forEach((h) => h.onDataCleared?.(tg && { kind: tg.kind, id: tg.id })); // 音楽プレーヤーの初期化など
    closeMiniFor(tg);
  };
  /**
   * 1 つのウィジェット・ミニアプリの、データかキャッシュを消す。書き込み待ちが、消したあとに書き戻されないよう、先に書き出す。
   * @param tg 対象
   * @param what `"data"` か `"cache"`
   */
  const clearStorage = async (tg: StorageTarget, what: "data" | "cache") => {
    try {
      appData.flushAll(); // 書き込み待ちが、消したあとに書き戻されないように
      await api.appClear(tg.kind, tg.id, what);
      if (what === "data") afterDataCleared(tg);
      flash(t(what === "data" ? "dataCleared" : "cacheCleared"));
    } catch (err) {
      flash(String(err).includes("in_use") ? t("clearInUse") : t("failed", { err: String(err) }));
    } finally {
      refreshStorage();
    }
  };
  /**
   * すべてのウィジェット・ミニアプリの、データかキャッシュを消す。
   * @param what `"data"` か `"cache"`
   */
  const clearAllStorage = async (what: "data" | "cache") => {
    try {
      appData.flushAll();
      const n = await api.appClearAll(what);
      if (what === "data") afterDataCleared();
      flash(t("clearedAll", { n }));
    } catch (err) {
      flash(t("failed", { err: String(err) }));
    } finally {
      refreshStorage();
    }
  };

  return { storage, refreshStorage, clearStorage, clearAllStorage };
}
