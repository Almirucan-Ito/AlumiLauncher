import { useEffect, useRef, useState } from "react";
import { type Item } from "../../shared/api/ApiModel";
import { t } from "../../shared/i18n/i18n";
import { checkStem, splitFileName } from "./ItemNameModel";

/** 入力した名前が使えないときの、理由の文言のキー。 */
const REASON = {
  empty: "renameEmpty",
  chars: "renameChars",
  edge: "renameEdge",
  reserved: "renameReserved",
  long: "renameLong",
  dot: "renameDot",
} as const;

/**
 * ファイルの名前を変えるダイアログ(元のファイルの名前が変わる)。名前の部分だけを入力して、拡張子(`.lnk` など)は、そのまま。使えない名前のときは、理由を出して、保存を止める。
 * @param item 対象のファイル
 * @param onSave 保存するとき(拡張子を含む新しい名前)
 * @param onCancel 取り消すとき
 */
export function RenameItemDialog({
  item,
  onSave,
  onCancel,
}: {
  item: Item;
  onSave: (fileName: string) => void;
  onCancel: () => void;
}) {
  const { stem, ext } = splitFileName(item.name);
  const [value, setValue] = useState(stem);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.select(), []);

  const result = checkStem(value, ext);
  const ok = result === "ok";

  return (
    <div className="modal" onClick={onCancel} onContextMenu={(e) => e.stopPropagation()}>
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t("renameFileTitle")}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) onSave(value + ext);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onCancel();
          }
        }}
      >
        <h3>{t("renameFileTitle")}</h3>
        <div className="rename-row">
          <input
            ref={inputRef}
            autoFocus
            value={value}
            maxLength={200}
            aria-label={t("renameFileTitle")}
            aria-invalid={!ok}
            className={ok ? undefined : "invalid"}
            title={item.path}
            onChange={(e) => setValue(e.target.value)}
          />
          {ext && <span className="rename-ext">{ext}</span>}
        </div>
        <div className="hint rename-hint" role={ok ? undefined : "alert"}>
          {ok ? (ext ? t("renameExtHint", { ext }) : "") : t(REASON[result])}
        </div>
        <div className="dialog-actions">
          <button type="button" className="small ghost-btn" onClick={onCancel}>
            {t("cancel")}
          </button>
          <button type="submit" className="small primary" disabled={!ok}>
            {t("save")}
          </button>
        </div>
      </form>
    </div>
  );
}
