import { type FolderEntry, type Item } from "../../shared/api/ApiModel";
import { DeleteDialog } from "../shell/DeleteDialog";
import { RenameDialog } from "./RenameDialog";
import { RenameItemDialog } from "./RenameItemDialog";
import { type useFolderActions } from "./useFolderActions";

/**
 * フォルダ・ファイルの操作で出す、入力・確認のダイアログ(フォルダの名前の変更・ファイルの名前の変更・ごみ箱へ移す前の確認)。対象が決まっているものだけ出す。
 * @param renaming 名前を変えるフォルダ
 * @param renamingItem 名前を変えるファイル
 * @param deleting ごみ箱へ移す前に確認するファイル
 * @param actions フォルダ・ファイルの操作(`useFolderActions`)
 * @param close 各ダイアログを閉じる関数(`folder` フォルダの名前の変更 / `item` ファイルの名前の変更 / `del` 削除の確認)
 */
export function FolderDialogs({
  renaming,
  renamingItem,
  deleting,
  actions,
  close,
}: {
  renaming: FolderEntry | null;
  renamingItem: Item | null;
  deleting: Item | null;
  actions: ReturnType<typeof useFolderActions>;
  close: { folder: () => void; item: () => void; del: () => void };
}) {
  return (
    <>
      {renaming && (
        <RenameDialog
          folder={renaming}
          onSave={(name) => actions.renameFolder(renaming.id, name)}
          onCancel={close.folder}
        />
      )}
      {renamingItem && (
        <RenameItemDialog
          item={renamingItem}
          onSave={(fileName) => actions.renameItem(renamingItem, fileName)}
          onCancel={close.item}
        />
      )}
      {deleting && <DeleteDialog item={deleting} onCancel={close.del} onConfirm={actions.deleteItem} />}
    </>
  );
}
