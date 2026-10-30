import { useCallback, type Dispatch, type SetStateAction } from "react";
import { api, type FolderEntry, type Item } from "../../shared/api/ApiModel";
import { t } from "../../shared/i18n/i18n";
import { useLatest } from "../../shared/lib/useLatest";
import { type MenuAction } from "../../shared/ui/MenuModel";
import { type useFolderActions } from "../folders/useFolderActions";

/**
 * ホーム・フォルダ内・アイコンの、右クリックメニュー(項目の中身)を作る。
 * @param actions フォルダ・アイコンの操作(`useFolderActions`)
 * @param showMenu メニューを出す関数
 * @param setRenaming 名前の変更の画面を開く関数
 * @param setDeleting 削除の確認の画面を開く関数
 * @returns フォルダのタイル・開いているフォルダの背景・アイコン・ホームの背景の、右クリックの処理
 */
export function useHomeMenus({
  actions,
  showMenu,
  setRenaming,
  setDeleting,
}: {
  actions: ReturnType<typeof useFolderActions>;
  showMenu: (x: number, y: number, actions: MenuAction[]) => void;
  setRenaming: Dispatch<SetStateAction<FolderEntry | null>>;
  setDeleting: Dispatch<SetStateAction<Item | null>>;
}) {
  const { shellAction, createHomeFolder, createHomeFile } = actions;
  // 操作の関数は毎回作り直されるので、メニューの中身は、押した時点の最新のものを、参照から使う(メニューの関数の同一性は保つ)
  const actionsRef = useLatest(actions);

  /** ホームのフォルダの右クリックメニュー(名前の変更・エクスプローラーで開く・プロパティ・一覧から外す)。 */
  const onFolderTileMenu = useCallback(
    (folder: FolderEntry, x: number, y: number) =>
      showMenu(x, y, [
        { label: t("renameFolder"), run: () => setRenaming(folder) },
        { label: t("openInExplorer"), run: () => api.reveal(folder.path, false) },
        {
          label: t("properties"),
          run: () => actionsRef.current.shellAction(() => api.showProperties(folder.path), "propertiesFailed"),
        },
        {
          label: t("removeFolder", { name: folder.name }),
          run: () => actionsRef.current.removeFolder(folder.id),
          danger: true,
        },
      ]),
    [showMenu, setRenaming, actionsRef],
  );
  /** 開いているフォルダ内の背景の右クリックメニュー(名前の変更・このフォルダを開く)。 */
  const onOpenFolderMenu = useCallback(
    (folder: FolderEntry, x: number, y: number) =>
      showMenu(x, y, [
        { label: t("renameFolder"), run: () => setRenaming(folder) },
        { label: t("openThisFolder"), run: () => api.reveal(folder.path, false) },
      ]),
    [showMenu, setRenaming],
  );
  /** アイコンの右クリックメニュー(プログラムから開く・ファイルの場所を開く・プロパティ・削除)。 */
  const onItemMenu = useCallback(
    (item: Item, x: number, y: number) => {
      showMenu(x, y, [
        { label: t("openWith"), run: () => shellAction(() => api.openWith(item.path), "openWithFailed") },
        { label: t("revealItem"), run: () => api.reveal(item.path, true) },
        {
          label: t("properties"),
          run: () => shellAction(() => api.showProperties(item.path), "propertiesFailed"),
        },
        { label: t("deleteItem"), run: () => setDeleting(item), danger: true },
      ]);
    },
    [showMenu, shellAction, setDeleting],
  );
  /** ホームの右クリックメニュー(新しいフォルダ / 新しいファイル)を出す。 */
  const onHomeMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    showMenu(e.clientX, e.clientY, [
      { label: t("newFolderHome"), run: createHomeFolder },
      { label: t("newFileHome"), run: createHomeFile },
    ]);
  };

  return { onFolderTileMenu, onOpenFolderMenu, onItemMenu, onHomeMenu };
}
