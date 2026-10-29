import { miniAppDesc, miniAppLabel, miniAppUrl, type MiniApp } from "../../shared/api/ApiModel";
import { usePickDrag } from "../../shared/drag/PickDragController";
import { t } from "../../shared/i18n/i18n";
import { FlatIcon } from "../../shared/ui/flat";
import {
  ClearAllButtons,
  StorageLine,
  storageKey,
  type StorageMap,
  type StorageTarget,
} from "../../shared/ui/storageui";

/**
 * ミニアプリのアイコン(画像があればそれ、無ければ標準のフラットなアイコン)。
 * @param app ミニアプリ
 * @param size 一辺の大きさ(px。既定 36)
 */
export function MiniAppIcon({ app, size = 36 }: { app: MiniApp; size?: number }) {
  return app.icon ? (
    <img className="flat-icon" src={miniAppUrl(app.id, app.icon)} width={size} height={size} alt="" draggable={false} />
  ) : (
    <FlatIcon kind="mini" size={size} />
  );
}

/**
 * ミニアプリの一覧(＋ ボタンなどから開く)。開く / ホームに追加 / フォルダを開く / データ・キャッシュの消去ができる。一覧の行をホームへドラッグして落としても、ホームに追加できる。
 * @param apps ミニアプリの一覧
 * @param onOpen 開くとき
 * @param onAddHome ホームに追加するとき
 * @param onOpenDir そのミニアプリのフォルダを開くとき
 * @param onOpenRoot miniapps フォルダ(置き場所)を開くとき
 * @param storage ミニアプリごとの、データ・キャッシュの大きさ
 * @param onClear データ・キャッシュを 1 つ消すとき
 * @param onClearAll すべて消すとき
 * @param onClose 閉じるとき
 */
export function MiniAppPicker({
  apps,
  onOpen,
  onAddHome,
  onOpenDir,
  onOpenRoot,
  storage,
  onClear,
  onClearAll,
  onClose,
}: {
  apps: MiniApp[];
  onOpen: (app: MiniApp) => void;
  onAddHome: (app: MiniApp) => void;
  onOpenDir: (app: MiniApp) => void;
  /** miniapps フォルダ(置き場所)をエクスプローラーで開く */
  onOpenRoot: () => void;
  /** ミニアプリごとの、データ・キャッシュの大きさと、消去 */
  storage: StorageMap;
  onClear: (tg: StorageTarget, what: "data" | "cache") => void;
  onClearAll: (what: "data" | "cache") => void;
  onClose: () => void;
}) {
  // 一覧から、ホームへドラッグして落とすと、ホームにアイコンが追加される
  const pick = usePickDrag({
    onDrop: (id, x, y) => {
      const app = apps.find((a) => a.id === id);
      if (app && document.elementsFromPoint(x, y).some((el) => el.matches("main.home, main.home *"))) onAddHome(app);
    },
  });
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
        <h3>{t("miniTitle")}</h3>
        <div className="wlist">
          {apps.length === 0 && <div className="hint">{t("miniNone")}</div>}
          {apps.map((a) => (
            <div
              className="wrow draggable"
              key={a.id}
              onPointerDown={(e) => pick.start(e, a.id, miniAppLabel(a), <MiniAppIcon app={a} size={28} />)}
            >
              <MiniAppIcon app={a} />
              <div className="winfo">
                <div className="wname">{miniAppLabel(a)}</div>
                {miniAppDesc(a) && <div className="wdesc">{miniAppDesc(a)}</div>}
                <StorageLine
                  usage={storage[storageKey({ kind: "miniapp", id: a.id })]}
                  onClear={(what) => onClear({ kind: "miniapp", id: a.id }, what)}
                />
              </div>
              <button className="small ghost-btn" title={t("widgetOpenDir")} onClick={() => onOpenDir(a)}>
                {t("widgetOpenDirShort")}
              </button>
              <button className="small ghost-btn" onClick={() => onAddHome(a)}>
                {t("miniAddHome")}
              </button>
              <button className="small primary" onClick={() => onOpen(a)}>
                {t("miniOpen")}
              </button>
            </div>
          ))}
        </div>
        <div className="hint">{t("miniHint")}</div>
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
