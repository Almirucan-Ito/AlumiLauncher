import { type Item } from "../../shared/api/ApiModel";
import { t } from "../../shared/i18n/i18n";

/**
 * ファイルを、ごみ箱へ移すかを確かめる画面。Enter で実行、Esc や外側のクリックで取りやめる。
 * @param item 対象のファイル
 * @param onCancel 取りやめるとき
 * @param onConfirm 「ごみ箱へ移動」を押したとき
 */
export function DeleteDialog({
  item,
  onCancel,
  onConfirm,
}: {
  item: Item;
  onCancel: () => void;
  onConfirm: (item: Item) => void;
}) {
  return (
    <div className="modal" onClick={onCancel} onContextMenu={(e) => e.stopPropagation()}>
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t("confirmDelete", { name: item.name })}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(item);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onCancel();
          }
        }}
      >
        <h3>{t("confirmDelete", { name: item.name })}</h3>
        <div className="hint" title={item.path}>
          {t("confirmDeleteHint")}
        </div>
        <div className="dialog-actions">
          <button type="button" className="small ghost-btn" onClick={onCancel}>
            {t("cancel")}
          </button>
          <button type="submit" className="small danger-btn" autoFocus>
            {t("deleteAction")}
          </button>
        </div>
      </form>
    </div>
  );
}
