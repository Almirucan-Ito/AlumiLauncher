import { useEffect } from "react";
import { type Config } from "../../shared/api/ApiModel";
import { setBeepVolume } from "../../shared/audio/BeepController";
import { launcherHooks } from "../plugins/PluginRegistry";
import { useTooltipToggle } from "../settings/useTooltipToggle";
import { useBackendEvents } from "./useBackendEvents";
import { useStartupRestore } from "./useStartupRestore";

/**
 * `App` の、画面に出ない常駐の処理: 音量の反映・ツールチップの切り替え・起動時の復元・Rust 側からの通知。
 * @param config いまの設定
 * @param mutate 最新の設定に変更を適用して保存する関数
 * @param bumpFolder そのフォルダの一覧を取り直させる関数
 * @param flash 画面に一言出す関数
 */
export function useAppServices(
  config: Config | null,
  mutate: (fn: (c: Config) => Config) => void,
  bumpFolder: (path: string) => void,
  flash: (msg: string) => void,
) {
  // 音楽プレーヤー: ランチャー全体の音量を反映する(曲の一覧・設定の保存/復元は、起動時の復元で行う)
  const masterVolume = (config?.settings?.masterVolume ?? 100) / 100;
  useEffect(() => {
    launcherHooks.forEach((h) => h.onMasterVolume?.(masterVolume)); // 音楽プレーヤーなど
    setBeepVolume(masterVolume); // タイマーなどの合図の音量も、設定の「音量」に合わせる
  }, [masterVolume]);
  // ボタンなどの説明(ツールチップ)は、設定でオフのとき出さない: カーソルが乗った要素の title を、一時的に退避する(オンに戻すと戻す)
  useTooltipToggle(config?.settings?.showTooltips ?? false);
  useStartupRestore(config, mutate);
  useBackendEvents(bumpFolder, flash);
}
