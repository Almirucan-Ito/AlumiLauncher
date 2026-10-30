import { useEffect, type MutableRefObject } from "react";
import { api, type Config, type FolderEntry } from "../../shared/api/ApiModel";
import { t } from "../../shared/i18n/i18n";
import { useLatest } from "../../shared/lib/useLatest";
import { type Origin } from "../folders/FolderModel";

/**
 * エクスプローラーからのドラッグ&ドロップ(ウィンドウへ、ファイル・フォルダを落としたとき)を処理する。
 * ・ウィジェット(widget.json)・ミニアプリ(miniapp.json)のフォルダは、取り込む
 * ・フォルダを開いているときは、そのフォルダへファイルを追加(移動)する
 * ・ホームでは、フォルダは一覧に追加し、ファイルは launcherFolder へ移して、アイコンとしてホームに並べる
 * @param stateRef 最新の `open`(開いているフォルダ)と設定を読むための参照
 * @param flash 画面に一言出す関数
 * @param addPaths ファイルを、フォルダへ追加する関数
 * @param addFolder フォルダを、一覧に追加する関数(登録できなければ `false`)
 * @param refreshMods ウィジェットの一覧を読み直す関数
 * @param refreshMinis ミニアプリの一覧を読み直す関数
 * @param setLauncherPath launcherFolder のパスを覚える関数
 * @param bumpFolder そのフォルダの一覧を取り直させる関数
 */
export function useExplorerDrop({
  stateRef,
  flash,
  addPaths,
  addFolder,
  refreshMods,
  refreshMinis,
  setLauncherPath,
  bumpFolder,
}: {
  stateRef: MutableRefObject<{ open: { folder: FolderEntry; origin: Origin } | null; config: Config | null }>;
  flash: (msg: string) => void;
  addPaths: (folder: FolderEntry, paths: string[]) => Promise<void>;
  addFolder: (path: string) => Promise<boolean>;
  refreshMods: () => Promise<void>;
  refreshMinis: () => Promise<unknown>;
  setLauncherPath: (path: string) => void;
  bumpFolder: (path: string) => void;
}) {
  // 受け取りの登録は一度だけ行い、落とされたときに、その時点の最新の関数を使う
  const fnsRef = useLatest({ flash, addPaths, addFolder, refreshMods, refreshMinis, setLauncherPath, bumpFolder });
  useEffect(() => {
    let off: (() => void) | undefined;
    let dead = false;
    api
      .onDrop(async (e) => {
        if (e.type !== "drop") return; // ドラッグ中の表示は出さない(ドロップされたときだけ処理する)
        const { flash, addPaths, addFolder, refreshMods, refreshMinis, setLauncherPath, bumpFolder } = fnsRef.current;
        const { open, config } = stateRef.current;
        try {
          const dirs = await api.filterDirs(e.paths);
          // ウィジェット(widget.json)・ミニアプリ(miniapp.json)のフォルダは、取り込む(それ以外のフォルダは、このあとの通常の処理)
          let plainDirs = dirs;
          if (dirs.length > 0) {
            const res = await api.installExtensions(dirs);
            plainDirs = res.rest;
            if (res.installed.length > 0) {
              flash(t("extInstalled", { names: res.installed.map((i) => i.name).join(", ") }));
              refreshMods();
              refreshMinis();
            }
          }
          if (open) {
            // フォルダを開いている間は、ファイルだけを追加する(ドロップされたフォルダは無視。メッセージも出さない)
            const isDir = new Set(dirs);
            return addPaths(
              open.folder,
              e.paths.filter((p) => !isDir.has(p)),
            );
          }
          if (!config) return;
          // ホームでは、ドロップしたフォルダそのものを一覧に追加する
          let added = 0;
          for (const d of plainDirs) if (await addFolder(d)) added++;
          if (added > 0) flash(t("addedFolders", { n: added }));
          // フォルダ以外(ショートカット・exe・ファイルなど)は、データ保持用の launcherFolder に保存し、
          // フォルダではなくアプリのアイコンとして、ホームに直接並べる
          const isDir = new Set(dirs);
          const files = e.paths.filter((p) => !isDir.has(p));
          if (files.length > 0) {
            const res = await api.addToLauncherFolder(files);
            setLauncherPath(res.path);
            bumpFolder(res.path);
            flash(t("addedToHome", { n: res.added }));
          }
        } catch (err) {
          flash(t("failed", { err: String(err) }));
        }
      })
      .then((fn) => (dead ? fn() : (off = fn)));
    return () => {
      dead = true;
      off?.();
    };
  }, [stateRef, fnsRef]);
}
