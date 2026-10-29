import { type FolderEntry } from "../../shared/api/ApiModel";
import { t } from "../../shared/i18n/i18n";
import { useEffect, useRef, useState } from "react";

/**
 * フォルダの表示名を変えるダイアログ(元のフォルダ名・パスは変えない)。空にして保存すると、元のフォルダ名になる。
 * @param folder 対象のフォルダ
 * @param onSave 保存するとき(新しい名前)
 * @param onCancel 取り消すとき
 */
export function RenameDialog({
  folder,
  onSave,
  onCancel,
}: {
  folder: FolderEntry;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const original =
    folder.path
      .replace(/[\\/]+$/, "")
      .split(/[\\/]/)
      .pop() || folder.path;
  const [value, setValue] = useState(folder.name);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.select(), []);

  return (
    <div className="modal" onClick={onCancel} onContextMenu={(e) => e.stopPropagation()}>
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t("renameFolder")}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSave(value.trim() || original);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onCancel();
          }
        }}
      >
        <input
          ref={inputRef}
          autoFocus
          value={value}
          maxLength={60}
          placeholder={original}
          aria-label={t("renameFolder")}
          title={folder.path}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="dialog-actions">
          <button type="button" className="small ghost-btn" onClick={onCancel}>
            {t("cancel")}
          </button>
          <button type="submit" className="small primary">
            {t("save")}
          </button>
        </div>
      </form>
    </div>
  );
}
