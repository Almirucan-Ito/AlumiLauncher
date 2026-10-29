import { useEffect, useMemo, useState } from "react";
import { api, type StartApp } from "../../shared/api/ApiModel";
import { t } from "../../shared/i18n/i18n";

/**
 * 「スタートメニューから追加」の画面。スタートメニューのアプリ(通常のアプリ・ストアアプリ)の一覧から選ぶと、そのショートカットを、ホームに複製して追加する(元のアプリ・スタートメニューは、そのまま)。
 * 名前で絞り込める。続けて何個でも追加できる(「完了」で閉じる)。
 * @param onAdded 追加できたとき(追加先のパスを渡す。ホームの表示を更新してもらう)
 * @param onError 失敗したとき(理由を渡す)
 * @param onClose 閉じるとき
 */
export function StartAppPicker({
  onAdded,
  onError,
  onClose,
}: {
  onAdded: (path: string, name: string) => void;
  onError: (err: string) => void;
  onClose: () => void;
}) {
  const [apps, setApps] = useState<StartApp[] | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api
      .listStartApps()
      .then((r) => live && setApps(r))
      .catch((e) => {
        if (!live) return;
        setApps([]);
        onError(String(e));
      });
    return () => {
      live = false;
    };
    // 開いたときに、一度だけ読む
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (apps ?? []).filter((a) => !q || a.name.toLowerCase().includes(q));
  }, [apps, query]);

  /**
   * アプリを 1 つ、ホームに追加する(追加中は、同じものを重ねて押せない)。
   * @param a 追加するアプリ
   */
  const add = async (a: StartApp) => {
    if (busy) return;
    setBusy(a.id);
    try {
      const res = await api.addStartApp(a.id);
      onAdded(res.path, a.name);
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="modal" onClick={onClose} onContextMenu={(e) => e.stopPropagation()}>
      <div
        className="dialog wpicker"
        role="dialog"
        aria-modal="true"
        aria-label={t("startPickerTitle")}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <h3>{t("startPickerTitle")}</h3>
        <input
          className="start-search"
          value={query}
          placeholder={t("startPickerSearch")}
          spellCheck={false}
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="wlist">
          {apps === null && <div className="hint">{t("startPickerLoading")}</div>}
          {apps !== null && shown.length === 0 && <div className="hint">{t("startPickerNone")}</div>}
          {shown.map((a) => (
            <div className="wrow" key={a.id}>
              <div className="winfo">
                <div className="wname">{a.name}</div>
              </div>
              <button className="small primary" disabled={busy !== null} onClick={() => add(a)}>
                {t("startPickerAdd")}
              </button>
            </div>
          ))}
        </div>
        <div className="hint">{t("startPickerHint")}</div>
        <div className="dialog-actions wrap-actions">
          <button className="small primary" onClick={onClose}>
            {t("widgetsDone")}
          </button>
        </div>
      </div>
    </div>
  );
}
