import "./style.css";
import { useEffect, useState } from "react";
import { useIcon } from "../../../launcher/modules/icons/IconController";
import { api, type Item } from "../../../launcher/shared/api/ApiModel";
import { t } from "../i18n";

/**
 * アイコンつきの小さなボタン(よく使うもの・最近開いたウィジェット用)。押すと、そのファイルを起動する。
 * @param item 起動する対象
 */
function UsageIcon({ item }: { item: Item }) {
  const src = useIcon(item);
  return (
    <button className="wicon" title={item.name} onClick={() => api.launch(item.path)}>
      {src ? <img src={src} alt="" draggable={false} /> : <span className="ghost" />}
    </button>
  );
}

/**
 * 「よく使うもの」(起動回数の上位 5 個)/「最近開いた」(直近 5 個)ウィジェット。起動したとき・ウィンドウが見えるようになったときに、一覧を取り直す。
 * @param kind `"frequent"` か `"recent"`
 */
export function UsageWidget({ kind }: { kind: "frequent" | "recent" }) {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    let live = true;
    const load = () =>
      api
        .listUsage(kind)
        .then((r) => live && setItems(r))
        .catch(() => {});
    load();
    window.addEventListener("alumi:launched", load);
    document.addEventListener("visibilitychange", load);
    return () => {
      live = false;
      window.removeEventListener("alumi:launched", load);
      document.removeEventListener("visibilitychange", load);
    };
  }, [kind]);
  return (
    <div className="wcard wusage">
      <div className="wcard-title">{t(kind === "frequent" ? "widgetFrequent" : "widgetRecent")}</div>
      <div className="wicons">
        {items.length === 0 ? (
          <span className="wdim">{t("usageEmpty")}</span>
        ) : (
          items.map((it) => <UsageIcon key={it.path} item={it} />)
        )}
      </div>
    </div>
  );
}
