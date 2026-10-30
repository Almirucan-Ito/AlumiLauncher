import { useEffect, useRef } from "react";
import { type Config, DEFAULT_SETTINGS, type MiniApp, api } from "../../shared/api/ApiModel";
import { appData } from "../../shared/api/AppDataModel";
import { useLatest } from "../../shared/lib/useLatest";
import { retryMissingIcons } from "../icons/IconController";
import { alarms } from "../miniapps/AlarmController";
import { migrateLegacyData } from "../miniapps/MigrationController";
import { launcherHooks } from "../plugins/PluginRegistry";

/**
 * 起動時にだけ行う後片付けと復元。
 *  1. 設定が読めたら(一度だけ): 以前の保存場所のデータを、それぞれのフォルダの `data` へ移し、音楽プレーヤーとアラームを元に戻す
 *  2. 起動の少しあと(一度だけ): 起動直後にアイコンの取得に失敗していたものを、取り直す(通知なし)。
 *     取得済みのアイコンまで全部取り直すと起動時の処理が倍になるので、失敗したものだけを再取得する
 *
 * @param config 画面に出している設定(読み込み前は `null`)
 * @param mutate 最新の設定に変更を適用して保存する関数
 */
export function useStartupRestore(config: Config | null, mutate: (fn: (c: Config) => Config) => void) {
  const dataReady = useRef(false);
  const mutateRef = useLatest(mutate);
  useEffect(() => {
    if (!config || dataReady.current) return;
    dataReady.current = true;
    (async () => {
      const list = await api.listMiniApps().catch(() => [] as MiniApp[]);
      if (await migrateLegacyData(config.settings?.widgetData ?? {})) {
        mutateRef.current((c) => ({ ...c, settings: { ...DEFAULT_SETTINGS, ...c.settings, widgetData: {} } }));
      }
      await Promise.all(launcherHooks.map((h) => h.onStart?.())); // 音楽プレーヤーの復元など
      for (const a of list) alarms.restore(a.id, (await appData.load("miniapp", a.id))._alarms);
    })();
    // 設定が最初に読めたときに、一度だけ行う(`dataReady` で、2 回目以降は何もしない)
  }, [config, mutateRef]);

  useEffect(() => {
    const id = setTimeout(retryMissingIcons, 1500);
    return () => clearTimeout(id);
  }, []);
}
