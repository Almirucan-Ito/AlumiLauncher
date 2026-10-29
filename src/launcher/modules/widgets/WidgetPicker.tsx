import {
  widgetAppLabel,
  widgetDesc,
  widgetKey,
  widgetLabel,
  widgetUrl,
  type ModWidget,
} from "../../shared/api/ApiModel";
import { usePickDrag } from "../../shared/drag/PickDragController";
import { FlatIcon } from "../../shared/ui/flat";
import {
  ClearAllButtons,
  StorageLine,
  storageKey,
  type StorageMap,
  type StorageTarget,
} from "../../shared/ui/storageui";
import { t } from "../../shared/i18n/i18n";
import { locateInBars, type BarId } from "./WidgetBar";

/**
 * ウィジェットの名前(組み込み・追加どちらも)。
 * @param id ウィジェット ID
 * @param mods 追加ウィジェットの一覧
 * @returns 表示言語に合わせた名前
 */
export function widgetName(id: string, mods: ModWidget[]): string {
  const m = mods.find((x) => widgetKey(x) === id);
  if (m) return widgetLabel(m);
  return id.replace(/^(mod|mini):/, "");
}

/**
 * ＋ボタンから開く、ウィジェットの追加画面。一覧(widgets フォルダのもの)から、ヘッダー/フッターへ追加・外す、フォルダを開く、データ・キャッシュを消す、ができる。一覧の行を、ヘッダー/フッターの好きなマスへドラッグして落としても追加できる。
 * @param props `header` / `footer` 並んでいる ID / `mods` 追加ウィジェット / `onToggle` 追加・外す / `onOpenModDir` フォルダを開く / `onOpenRoot` widgets フォルダを開く / `onDragActive`・`onDropWidget`・`onPreview` ドラッグ / `storage`・`onClear`・`onClearAll` データ・キャッシュ / `onClose` 閉じる
 */
export function WidgetPicker({
  header,
  footer,
  mods,
  onToggle,
  onOpenModDir,
  onOpenRoot,
  onDragActive,
  onDropWidget,
  onPreview,
  storage,
  onClear,
  onClearAll,
  onClose,
}: {
  header: string[];
  footer: string[];
  mods: ModWidget[];
  onToggle: (bar: BarId, id: string) => void;
  onOpenModDir: (info: ModWidget) => void;
  /** widgets フォルダ(置き場所)をエクスプローラーで開く */
  onOpenRoot: () => void;
  onDragActive: (on: boolean) => void;
  /** 一覧から、ヘッダー/フッターの col マス目へドラッグして追加 */
  onDropWidget: (id: string, bar: BarId, col: number) => void;
  /** 動かしている間、指の位置を知らせる(落とす場所を枠で示してもらう) */
  onPreview: (id: string, x: number, y: number) => void;
  /** ウィジェットごとの、データ・キャッシュの大きさと、消去 */
  storage: StorageMap;
  onClear: (tg: StorageTarget, what: "data" | "cache") => void;
  onClearAll: (what: "data" | "cache") => void;
  onClose: () => void;
}) {
  const pick = usePickDrag({
    onActive: onDragActive,
    onMove: onPreview,
    onDrop: (id, x, y) => {
      const to = locateInBars(x, y);
      if (to) onDropWidget(id, to.bar, to.col);
    },
  });
  // 一覧は、widgets フォルダ(と、ミニアプリの中の widgets フォルダ)の中身。組み込みのウィジェットも、widgets フォルダに入っている
  const rows = mods.map((m) => ({
    id: widgetKey(m),
    name: widgetLabel(m),
    desc: widgetDesc(m) || (m.kind === "mini" ? t("widgetFromApp", { a: widgetAppLabel(m) }) : ""),
    dir: widgetKey(m),
    icon: m.icon ? widgetUrl(m, m.icon) : "",
    // データ・キャッシュの置き場所: ミニアプリの中のウィジェットは、そのミニアプリ。データを共有するもの(ToDo など)は、共有先のミニアプリ。それ以外は、widgets フォルダの中の自分のフォルダ
    target: (m.kind === "mini"
      ? { kind: "miniapp", id: m.app }
      : m.dataApp
        ? { kind: "miniapp", id: m.dataApp }
        : { kind: "widget", id: m.id }) as StorageTarget,
  }));
  return (
    <div
      className={`modal${pick.dragging ? " picking" : ""}`}
      onClick={onClose}
      onContextMenu={(e) => e.stopPropagation()}
    >
      {pick.ghost}
      <div
        className="dialog wpicker"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <h3>{t("widgetsTitle")}</h3>
        <div className="wlist">
          {rows.map((r) => (
            <div
              className="wrow draggable"
              key={r.id}
              onPointerDown={(e) =>
                pick.start(
                  e,
                  r.id,
                  r.name,
                  r.icon ? (
                    <img className="flat-icon" src={r.icon} width={28} height={28} alt="" />
                  ) : (
                    <FlatIcon kind={r.id} size={28} />
                  ),
                )
              }
            >
              {r.icon ? (
                <img className="flat-icon" src={r.icon} width={36} height={36} alt="" draggable={false} />
              ) : (
                <FlatIcon kind={r.id} />
              )}
              <div className="winfo">
                <div className="wname">{r.name}</div>
                {r.desc && <div className="wdesc">{r.desc}</div>}
                <StorageLine usage={storage[storageKey(r.target)]} onClear={(what) => onClear(r.target, what)} />
              </div>
              {r.dir && (
                <button
                  className="small ghost-btn"
                  title={t("widgetOpenDir")}
                  onClick={() => onOpenModDir(mods.find((m) => widgetKey(m) === r.dir)!)}
                >
                  {t("widgetOpenDirShort")}
                </button>
              )}
              {(["header", "footer"] as BarId[]).map((bar) => {
                const on = (bar === "header" ? header : footer).includes(r.id);
                return (
                  <button
                    key={bar}
                    className={`small wtoggle${on ? " on" : ""}`}
                    aria-pressed={on}
                    onClick={() => onToggle(bar, r.id)}
                  >
                    {t(bar === "header" ? "widgetHeader" : "widgetFooter")}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="hint">{t("widgetsHint")}</div>
        <div className="hint">{t("storageHint")}</div>
        <div className="dialog-actions wrap-actions">
          <ClearAllButtons onClearAll={onClearAll} />
          <button className="small ghost-btn" onClick={onOpenRoot}>
            {t("openRoot")}
          </button>
          <button className="small primary" onClick={onClose} autoFocus>
            {t("widgetsDone")}
          </button>
        </div>
      </div>
    </div>
  );
}
