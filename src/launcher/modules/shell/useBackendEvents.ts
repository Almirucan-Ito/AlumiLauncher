import { useEffect, useRef } from "react";
import { api } from "../../shared/api/ApiModel";
import { t } from "../../shared/i18n/i18n";

/**
 * Rust 側からの通知を受ける。
 *  ・登録フォルダの中身が、エクスプローラーなど外で変わったとき: すぐに一覧(とフォルダのプレビュー)へ反映する
 *  ・ミニアプリのフォルダが、外で増えた・減ったとき: ミニアプリの一覧を読み直す(ショートカットウィジェットの、無くなったミニアプリが、すぐ外れる)
 *  ・設定を保存できなかったとき: 知らせる(続けて失敗しても、10 秒に 1 回まで)
 *
 * @param bumpFolder そのフォルダの一覧を取り直させる関数
 * @param flash 画面に一言出す関数
 * @param refreshMinis ミニアプリの一覧を読み直す関数
 */
export function useBackendEvents(
  bumpFolder: (path: string) => void,
  flash: (msg: string) => void,
  refreshMinis: () => unknown,
) {
  // 受け取りの登録は一度だけ行い、受け取ったときに、最新の関数を呼ぶ
  const refreshMinisRef = useRef(refreshMinis);
  refreshMinisRef.current = refreshMinis;
  useEffect(() => {
    let off: (() => void) | undefined;
    let dead = false;
    api.onMiniappsChanged(() => void refreshMinisRef.current()).then((fn) => (dead ? fn() : (off = fn)));
    return () => {
      dead = true;
      off?.();
    };
  }, [refreshMinisRef]);

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
