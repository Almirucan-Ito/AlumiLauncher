import { useCallback, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { type Config, type FolderEntry, type Item, api } from "../../shared/api/ApiModel";
import { t } from "../../shared/i18n/i18n";
import { newId } from "../../shared/lib/IdUtil";
import { fileLabel } from "../../shared/lib/PathUtil";
import { type useUndoHistory } from "../history/useUndoHistory";
import { HOME_ORDER_KEY, type HomeEntry, entryKey } from "../home/HomeModel";
import { type OpenFolder } from "./FolderModel";

/**
 * 設定に、フォルダを足す(同じパスがすでにあれば、そのまま)。表示名は、フォルダ名。
 * @param cfg 元の設定
 * @param path 足すフォルダのパス
 * @returns 新しい設定
 */
function addFolderPath(cfg: Config, path: string): Config {
  if (cfg.folders.some((f) => f.path.toLowerCase() === path.toLowerCase())) return cfg;
  const name =
    path
      .replace(/[\\/]+$/, "")
      .split(/[\\/]/)
      .pop() || path;
  return { ...cfg, folders: [...cfg.folders, { id: newId(), name, path }] };
}

/**
 * フォルダ・アイコンの操作(追加・作成・名前の変更・一覧から外す・ごみ箱へ・ホームでの重ね落とし)をまとめる。
 * 元に戻せる操作は、履歴(`useUndoHistory`)に記録する。
 *
 * @param configRef 常に最新の設定
 * @param mutate 最新の設定に変更を適用して保存する関数
 * @param flash 画面に一言出す関数
 * @param launcherRef ホームのアイコンの保存先(launcherFolder)のパス
 * @param setLauncherPath ホームのアイコンの保存先のパスを変える関数
 * @param stateRef 最新の `open`(開いているフォルダ)を読むための参照
 * @param entriesRef いまのホームの並び
 * @param setOpen 開いているフォルダを変える関数
 * @param setRenaming 名前を変えるフォルダを決める関数(名前の入力画面を出す)
 * @param setDeleting ごみ箱へ移す前の確認に出すファイルを決める関数
 * @param reload 全体の再読み込みの番号(変わると、すべての一覧を取り直す)
 * @param history 元に戻す/やり直しの履歴(`useUndoHistory` の戻り値)
 * @returns 操作の関数と、フォルダごとの再読み込みの番号(`tickFor`)
 */
export function useFolderActions({
  configRef,
  mutate,
  flash,
  launcherRef,
  setLauncherPath,
  stateRef,
  entriesRef,
  setOpen,
  setRenaming,
  setDeleting,
  reload,
  history,
}: {
  configRef: MutableRefObject<Config | null>;
  mutate: (fn: (c: Config) => Config) => void;
  flash: (msg: string) => void;
  launcherRef: MutableRefObject<string>;
  setLauncherPath: (path: string) => void;
  stateRef: MutableRefObject<{ open: OpenFolder | null; config: Config | null }>;
  entriesRef: MutableRefObject<HomeEntry[]>;
  setOpen: Dispatch<SetStateAction<OpenFolder | null>>;
  setRenaming: Dispatch<SetStateAction<FolderEntry | null>>;
  setDeleting: Dispatch<SetStateAction<Item | null>>;
  reload: number;
  history: ReturnType<typeof useUndoHistory>;
}) {
  const { snapshot, restoreSnapshot, pushHistory, flushReorder, reorderRecorded, recorded } = history;

  // フォルダごとの再読み込み(追加・削除したフォルダだけ一覧を取り直す)
  const [folderTick, setFolderTick] = useState<Record<string, number>>({});
  /**
   * そのフォルダの一覧だけを、取り直させる(追加・削除したフォルダだけ、読み直すため)。
   * @param path フォルダのパス
   */
  const bumpFolder = useCallback((path: string) => setFolderTick((m) => ({ ...m, [path]: (m[path] ?? 0) + 1 })), []);
  /**
   * フォルダの再読み込みの番号(全体の再読み込み + そのフォルダだけの再読み込み)。変わると、一覧を取り直す。
   * @param path フォルダのパス
   */
  const tickFor = (path: string) => reload + (folderTick[path] ?? 0);

  /**
   * 登録できるフォルダか確認してから、一覧に追加する。登録できなければ、メッセージを出す。
   * @param path フォルダのパス
   * @returns 追加できたら `true`
   */
  const addFolder = async (path: string): Promise<boolean> => {
    if (!(await api.validateFolder(path))) {
      flash(t("folderNotAllowed"));
      return false;
    }
    mutate((c) => addFolderPath(c, path));
    return true;
  };

  /** フォルダを選ぶダイアログを出して、一覧に追加する。 */
  const pickAndAddFolder = async () => {
    const path = await api.pickFolder();
    if (path) await addFolder(path);
  };

  /**
   * フォルダ内の並び順を保存する(元に戻せる操作にまとめる)。
   * @param folderId フォルダの ID
   * @param paths 新しい並び(パスの一覧)
   */
  const setOrder = (folderId: string, paths: string[]) =>
    reorderRecorded(() => mutate((c) => ({ ...c, orders: { ...c.orders, [folderId]: paths } })));

  /**
   * フォルダの表示名を変える(元に戻せる)。
   * @param id フォルダの ID
   * @param name 新しい名前
   */
  const renameFolder = (id: string, name: string) => {
    recorded(() => mutate((c) => ({ ...c, folders: c.folders.map((f) => (f.id === id ? { ...f, name } : f)) })));
    setOpen((o) => (o && o.folder.id === id ? { ...o, folder: { ...o.folder, name } } : o));
    setRenaming(null);
  };

  /**
   * ショートカット/ファイルを、ごみ箱へ移動する(完全削除はしない)。
   * @param item 対象
   */
  const deleteItem = async (item: Item) => {
    setDeleting(null);
    try {
      await api.deleteItem(item.path);
      const folderPath = stateRef.current.open?.folder.path ?? launcherRef.current;
      if (folderPath) bumpFolder(folderPath);
      flash(t("deleted", { name: item.name }));
    } catch (err) {
      flash(t("deleteFailed", { err: String(err) }));
    }
  };

  /**
   * 「プログラムから開く」「プロパティ」のように、Windows の画面を出す操作を実行する。失敗したら、通知する。
   * @param run 実行する操作
   * @param failedKey 失敗したときの文言のキー
   */
  const shellAction = useCallback(
    (run: () => Promise<void>, failedKey: "openWithFailed" | "propertiesFailed") =>
      run().catch((err) => flash(t(failedKey, { err: String(err) }))),
    [flash],
  );

  /**
   * ホームで作ったフォルダ(データフォルダの `folders` の下)か。
   * @param p フォルダのパス
   */
  const isCreatedFolder = (p: string) => {
    const lp = launcherRef.current;
    if (!lp) return false;
    const norm = (s: string) => s.toLowerCase().replace(/\//g, "\\");
    const root = norm(lp.replace(/launcherFolder\d*[\\/]*$/i, "")) + "folders\\";
    return norm(p).startsWith(root);
  };

  /**
   * フォルダを一覧から外す(元に戻せる)。ホームで作ったフォルダは、中のアイコンをホームへ戻してから外す(アイコンを失わない)。外したフォルダの並び順も捨てる(設定ファイルが肥大化しないように)。
   * @param id フォルダの ID
   */
  const removeFolder = async (id: string) => {
    const folder = configRef.current?.folders.find((f) => f.id === id);
    if (!folder) return;
    const apply = () =>
      mutate((c) => ({
        ...c,
        folders: c.folders.filter((f) => f.id !== id),
        // 外したフォルダの並び順も捨てる(設定ファイルが肥大化しないように)
        orders: Object.fromEntries(Object.entries(c.orders ?? {}).filter(([k]) => k !== id)),
      }));
    const home = launcherRef.current;
    if (!home || !isCreatedFolder(folder.path)) return recorded(apply);

    // ホームで作ったフォルダは、中のアイコンをホームへ戻してから一覧から外す(アイコンを失わない)
    flushReorder();
    try {
      let moved = await api.moveAll(folder.path, home);
      const before = snapshot();
      apply();
      const after = snapshot();
      bumpFolder(home);
      pushHistory({
        undo: async () => {
          for (const p of moved) await api.moveItem(p, folder.path);
          restoreSnapshot(before);
        },
        redo: async () => {
          moved = await api.moveAll(folder.path, home);
          restoreSnapshot(after);
        },
      });
    } catch (err) {
      flash(t("moveFailed", { err: String(err) }));
    }
  };

  /**
   * ファイルを、フォルダへ追加する(移動)。
   * @param folder 追加先のフォルダ
   * @param paths ファイルのパス
   */
  const addPaths = useCallback(
    async (folder: FolderEntry, paths: string[]) => {
      if (paths.length === 0) return;
      try {
        const n = await api.addToFolder(folder.path, paths);
        bumpFolder(folder.path);
        flash(t("addedFiles", { n, name: folder.name }));
      } catch (err) {
        flash(t("failed", { err: String(err) }));
      }
    },
    [flash, bumpFolder],
  );

  /** ホームに、空のフォルダを新しく作る(元に戻せる。作ったあと、名前を付けられる)。 */
  const createHomeFolder = async () => {
    if (!configRef.current) return;
    try {
      const id = newId();
      const dir = await api.createFolder(id, []);
      flushReorder();
      const before = snapshot();
      const folder = { id, name: t("newFolderName"), path: dir };
      mutate((c) => ({ ...c, folders: [...c.folders, folder] }));
      const after = snapshot();
      pushHistory({ undo: () => restoreSnapshot(before), redo: () => restoreSnapshot(after) });
      setRenaming(folder);
    } catch (err) {
      flash(t("failed", { err: String(err) }));
    }
  };

  /** ホームに、空のテキストファイル(.txt)を新しく作る。 */
  const createHomeFile = async () => {
    try {
      const path = await api.createTextFile("", "", t("newTextName"));
      const home = launcherRef.current || (await api.getLauncherFolder());
      setLauncherPath(home);
      bumpFolder(home);
      flash(t("createdFile", { name: fileLabel(path) }));
    } catch (err) {
      flash(t("failed", { err: String(err) }));
    }
  };

  // ホームのアイコンをほかのアイコン/フォルダに重ねて離したとき
  //   アイコン → アイコン: 新しいフォルダを作って、2つを入れる(重ねた相手の位置にフォルダができる)
  //   アイコン → フォルダ: そのフォルダへ移動する
  /**
   * ドラッグ中のアイコンを、相手に重ねられるか。アイコン → アイコン(新しいフォルダを作る)と、アイコン → フォルダ(そのフォルダへ移す)だけ。
   * @param dragKey ドラッグ中の項目の識別子
   * @param targetKey 相手の項目の識別子
   */
  const canDropOnto = useCallback(
    (dragKey: string, targetKey: string) =>
      dragKey.startsWith("i:") && (targetKey.startsWith("f:") || targetKey.startsWith("i:")),
    [],
  );

  /**
   * ホームのアイコンを、ほかのアイコン/フォルダに重ねて離したとき。フォルダへは、中央に重ねてすぐ離しても、フォルダの一番後ろへ入る。新しいフォルダを作るのは、重ねて待つ時間が過ぎたときだけ(通りがかりに作ってしまわないように)。どちらも、元に戻せる。
   * @param dragKey ドラッグしたアイコン
   * @param targetKey 重ねた相手
   * @param ready 重ねて待つ時間が過ぎていたか
   */
  const onDropOntoHome = async (dragKey: string, targetKey: string, ready: boolean) => {
    // フォルダへは、中央に重ねてすぐ離しても、フォルダの一番後ろに入る。
    // 新しいフォルダを作るのは、重ねて待つ時間が過ぎたときだけ(通りがかりに作ってしまわないように)
    if (!ready && !targetKey.startsWith("f:")) return;
    const dragPath = dragKey.slice(2);
    try {
      if (targetKey.startsWith("f:")) {
        const folder = configRef.current?.folders.find((f) => `f:${f.id}` === targetKey);
        if (!folder) return;
        const home = launcherRef.current;
        let cur = await api.moveItem(dragPath, folder.path);
        flushReorder();
        pushHistory({
          undo: async () => void (cur = await api.moveItem(cur, home)),
          redo: async () => void (cur = await api.moveItem(cur, folder.path)),
        });
        bumpFolder(home);
        bumpFolder(folder.path);
        flash(t("addedFiles", { n: 1, name: folder.name }));
      } else {
        const id = newId();
        const home = launcherRef.current;
        const dir = await api.createFolder(id, [targetKey.slice(2), dragPath]);
        const newKey = `f:${id}`;
        // 重ねた相手の位置に新しいフォルダを置き、ドラッグしたアイコンは並びから外す
        const keys = entriesRef.current
          .map(entryKey)
          .filter((k) => k !== dragKey)
          .map((k) => (k === targetKey ? newKey : k));
        flushReorder();
        const before = snapshot();
        mutate((c) => ({
          ...c,
          folders: [...c.folders, { id, name: t("newFolder"), path: dir }],
          orders: { ...c.orders, [HOME_ORDER_KEY]: keys },
        }));
        const after = snapshot();
        let moved = [targetKey.slice(2), dragPath]; // ホームにあるときのパス(やり直しで、もう一度フォルダに入れる)
        pushHistory({
          undo: async () => {
            moved = await api.moveAll(dir, home);
            restoreSnapshot(before);
          },
          redo: async () => {
            await api.createFolder(id, moved);
            restoreSnapshot(after);
          },
        });
        bumpFolder(home);
      }
    } catch (err) {
      flash(t("moveFailed", { err: String(err) }));
    }
  };

  return {
    bumpFolder,
    tickFor,
    addFolder,
    pickAndAddFolder,
    setOrder,
    renameFolder,
    deleteItem,
    shellAction,
    removeFolder,
    addPaths,
    createHomeFolder,
    createHomeFile,
    canDropOnto,
    onDropOntoHome,
  };
}
