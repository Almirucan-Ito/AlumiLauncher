import { useCallback, useRef, useState } from "react";
import { type Config, api } from "../../shared/api/ApiModel";

/**
 * アプリ全体の設定(`Config`)を持つ。画面の状態と、Rust 側への保存を、いっしょに扱う。
 *
 * 非同期の途中(ダイアログを開いている間など)に設定が変わっても、古い内容で上書きしないよう、
 * 変更は、常に最新の設定(`configRef`)に対して適用する(`mutate`)。
 *
 * @returns
 * - `config`: 画面に出す設定(読み込み前は `null`)
 * - `setConfig`: 画面の状態だけを置き換える(保存はしない。Rust 側で作り直した設定を受け取るときに使う)
 * - `configRef`: 常に最新の設定(イベントの中から読むために使う)
 * - `update`: 設定を置き換えて保存する
 * - `mutate`: 最新の設定に変更を適用して保存する
 */
export function useConfigStore() {
  const [config, setConfig] = useState<Config | null>(null);
  const configRef = useRef<Config | null>(null);
  configRef.current = config;

  /**
   * 設定を置き換えて保存する(画面の状態と、`configRef` を更新し、Rust 側へ保存を頼む)。
   * @param next 新しい設定
   * @returns Rust 側が受け取るまで待つための約束(待たなくてもよい)
   */
  const update = useCallback((next: Config) => {
    configRef.current = next;
    setConfig(next);
    return api.saveConfig(next);
  }, []);

  /**
   * 最新の設定に変更を適用して保存する。
   * @param fn 設定を受け取り、新しい設定を返す関数
   * @returns Rust 側が受け取るまで待つための約束(設定がまだ読めていなければ `undefined`)
   */
  const mutate = useCallback(
    (fn: (c: Config) => Config) => (configRef.current ? update(fn(configRef.current)) : undefined),
    [update],
  );

  return { config, setConfig, configRef, update, mutate };
}
