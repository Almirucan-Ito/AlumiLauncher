import { useEffect } from "react";
import { api } from "../../shared/api/ApiModel";
import { t } from "../../shared/i18n/i18n";

/**
 * Rust 側からの通知を受ける。
 *  ・登録フォルダの中身が、エクスプローラーなど外で変わったとき: すぐに一覧(とフォルダのプレビュー)へ反映する
 *  ・設定を保存できなかったとき: 知らせる(続けて失敗しても、10 秒に 1 回まで)
 *
 * @param bumpFolder そのフォルダの一覧を取り直させる関数
 * @param flash 画面に一言出す関数
 */
export function useBackendEvents(bumpFolder: (path: string) => void, flash: (msg: string) => void) {
  useEffect(() => {
    let off: (() => void) | undefined;
    let dead = false;
    api.onFolderChanged((path) => bumpFolder(path)).then((fn) => (dead ? fn() : (off = fn)));
    return () => {
      dead = true;
      off?.();
    };
  }, [bumpFolder]);

  useEffect(() => {
    let off: (() => void) | undefined;
    let dead = false;
    let last = 0;
    api
      .onSaveFailed(() => {
        if (Date.now() - last < 10_000) return;
        last = Date.now();
        flash(t("saveFailed"));
      })
      .then((fn) => (dead ? fn() : (off = fn)));
    return () => {
      dead = true;
      off?.();
    };
  }, [flash]);
}
