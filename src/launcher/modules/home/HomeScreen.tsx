import { useCallback, useMemo, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { api, type Config, type FolderEntry, type Item, type Settings } from "../../shared/api/ApiModel";
import { TUNING } from "../../shared/api/TuningModel";
import { t } from "../../shared/i18n/i18n";
import { AppTile } from "../../shared/ui/AppTile";
import { type MenuAction } from "../../shared/ui/MenuModel";
import { Pager, type PagerLayout } from "../../shared/ui/Pager";
import { type OpenFolder, type Origin } from "../folders/FolderModel";
import { FolderTile } from "../folders/FolderTile";
import { FolderView } from "../folders/FolderView";
import { type useFolderActions } from "../folders/useFolderActions";
import { type useUndoHistory } from "../history/useUndoHistory";
import { useWidgetDrop } from "../widgets/useWidgetDrop";
import { HOME_ORDER_KEY, entryKey, type HomeEntry } from "./HomeModel";
import { type useDragHandover } from "./useDragHandover";
import { useHomeMenus } from "./useHomeMenus";

/** ホーム画面(`HomeScreen`)に、`App` から渡すもの。 */
export interface HomeScreenProps {
  config: Config | null;
  settings: Pick<Settings, "dragDelayMs" | "mergeDelayMs">;
  /** ホームに並べるもの(フォルダ + ホームに直接置いたショートカット) */
  entries: HomeEntry[];
  /** 検索の語(空なら、検索していない)と、ホームの項目が検索に当たるか */
  q: string;
  entryMatches: (e: HomeEntry) => boolean;
  /** 開いているフォルダ・フォルダを開く/閉じる */
  open: OpenFolder | null;
  setOpen: Dispatch<SetStateAction<OpenFolder | null>>;
  /** ミニアプリを開いているか(開いている間は、ホームのキー操作を止める) */
  miniOpen: boolean;
  homeLayout: PagerLayout;
  modalLayout: PagerLayout;
  actions: ReturnType<typeof useFolderActions>;
  handover: ReturnType<typeof useDragHandover>;
  reorderRecorded: ReturnType<typeof useUndoHistory>["reorderRecorded"];
  mutate: (fn: (c: Config) => Config) => void;
  configRef: MutableRefObject<Config | null>;
  entriesRef: MutableRefObject<HomeEntry[]>;
  stateRef: MutableRefObject<{ open: OpenFolder | null; config: Config | null }>;
  launcherRef: MutableRefObject<string>;
  flash: (msg: string) => void;
  showMenu: (x: number, y: number, actions: MenuAction[]) => void;
  setRenaming: Dispatch<SetStateAction<FolderEntry | null>>;
  setDeleting: Dispatch<SetStateAction<Item | null>>;
}

/**
 * ホーム画面: アイコンとフォルダの一覧(ページ送り・ドラッグ・右クリック)と、開いたフォルダの画面。
 * ホームとフォルダ内の間のドラッグの受け渡し(`handover`)と、ウィジェットへのドロップは、ここでつなぐ。
 */
export function HomeScreen({
  config,
  settings,
  entries,
  q,
  entryMatches,
  open,
  setOpen,
  miniOpen,
  homeLayout,
  modalLayout,
  actions,
  handover,
  reorderRecorded,
  mutate,
  configRef,
  entriesRef,
  stateRef,
  launcherRef,
  flash,
  showMenu,
  setRenaming,
  setDeleting,
}: HomeScreenProps) {
  const { tickFor, setOrder, canDropOnto, onDropOntoHome, bumpFolder } = actions;
  const {
    homeSlot,
    dragIn,
    leaving,
    onLeaving,
    subscribePointer,
    dropInfoRef,
    onMergeReady,
    onHomeDragMove,
    onHomeDragEnd,
    onItemDragMove,
    onItemDragEnd,
    homeSlotAt,
    homePagerApi,
    resetHandover,
  } = handover;
  const { onFolderTileMenu, onOpenFolderMenu, onItemMenu, onHomeMenu } = useHomeMenus({
    config,
    actions,
    showMenu,
    setRenaming,
    setDeleting,
  });
  // ホームのアイコン・フォルダを、ウィジェットの上へドラッグして落とす(ショートカットウィジェットなど。機能は modules/widgets)
  const widgetDrop = useWidgetDrop({ configRef, entriesRef });

  const renderEntries = useMemo<HomeEntry[]>(
    () => {
      // 検索中は、見つかったものだけを並べる(並べ替え・持ち込みはしない)
      const list = q ? entries.filter(entryMatches) : entries;
      return homeSlot === null || q ? list : [...list.slice(0, homeSlot), { kind: "slot" }, ...list.slice(homeSlot)];
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, homeSlot, q],
  );

  /**
   * フォルダを開く。
   * @param folder 開くフォルダ
   * @param origin アニメーションの起点
   */
  const onOpen = useCallback((folder: FolderEntry, origin: Origin) => setOpen({ folder, origin }), [setOpen]);

  /**
   * アイコンをウィンドウの外へドラッグした: OS 標準のドラッグに切り替えて、デスクトップやエクスプローラーのフォルダへ移動する。移動されたかに関わらず、一覧を取り直す(エクスプローラーの「最適化された移動」だと、移動したのに結果が「なし」で返ることがあるため)。
   * @param path ドラッグするファイルのパス
   * @returns 切り替えたら `true`
   */
  const dragOutOfWindow = (path: string): boolean => {
    if (!path) return false;
    resetHandover();
    (async () => {
      try {
        const moved = await api.startFileDrag(path);
        // 移動されたかどうかに関わらず、一覧を取り直す
        const folderPath = stateRef.current.open?.folder.path;
        if (folderPath) bumpFolder(folderPath);
        if (launcherRef.current) bumpFolder(launcherRef.current);
        if (moved) flash(t("movedOut"));
      } catch (err) {
        flash(t("moveFailed", { err: String(err) }));
      }
    })();
    return true;
  };

  return (
    <>
      <main className="home" onContextMenu={onHomeMenu}>
        {config && entries.length === 0 && <div className="empty">{t("emptyHome")}</div>}
        {config && entries.length > 0 && q && renderEntries.length === 0 && (
          <div className="empty">{t("searchNone")}</div>
        )}
        {config && renderEntries.length > 0 && (
          <Pager
            keyboard={!open && !miniOpen}
            layout={homeLayout}
            items={renderEntries}
            getId={(e) => (e.kind === "slot" ? null : entryKey(e))}
            canDropOnto={canDropOnto}
            onDragCancel={() => {
              resetHandover();
              widgetDrop.clear();
            }}
            mergeZone={(_drag, target) => (target.startsWith("f:") ? TUNING.folderZone : TUNING.centerZone)}
            onDropOnto={onDropOntoHome}
            slotRef={homeSlotAt}
            apiRef={homePagerApi}
            quickDrop={(_drag, target) => target.startsWith("f:")}
            onMergeReady={onMergeReady}
            onDragMove={(key, x, y) => {
              onHomeDragMove(key, x, y);
              widgetDrop.onMove(key, x, y);
            }}
            onDragEnd={(key, x, y) => onHomeDragEnd(key, x, y) || widgetDrop.onEnd(key, x, y)}
            onDragOutside={(id) => (id.startsWith("i:") ? dragOutOfWindow(id.slice(2)) : false)}
            dragDelayMs={settings.dragDelayMs}
            mergeDelayMs={settings.mergeDelayMs}
            onReorder={
              q
                ? undefined
                : (next) =>
                    reorderRecorded(() =>
                      mutate((c) => ({
                        ...c,
                        orders: { ...c.orders, [HOME_ORDER_KEY]: next.filter((e) => e.kind !== "slot").map(entryKey) },
                      })),
                    )
            }
            render={(e) =>
              e.kind === "slot" ? (
                <div key="slot" className="slot-hole" />
              ) : e.kind === "folder" ? (
                <FolderTile
                  key={e.folder.id}
                  folder={e.folder}
                  order={config.orders?.[e.folder.id]}
                  reload={tickFor(e.folder.path)}
                  onOpen={onOpen}
                  onMenu={onFolderTileMenu}
                />
              ) : (
                // ホームに直接置いたショートカットは、フォルダではなくアプリのアイコンとして表示する
                <AppTile key={e.item.path} item={e.item} onMenu={onItemMenu} bare />
              )
            }
          />
        )}
      </main>

      {open && (
        <FolderView
          folder={open.folder}
          order={config?.orders?.[open.folder.id]}
          origin={open.origin}
          layout={modalLayout}
          reload={tickFor(open.folder.path)}
          onOrder={setOrder}
          onClose={() => setOpen(null)}
          onItemMenu={onItemMenu}
          onFolderMenu={onOpenFolderMenu}
          dragDelayMs={settings.dragDelayMs}
          dragIn={dragIn}
          subscribePointer={subscribePointer}
          dropInfo={dropInfoRef}
          leaving={leaving}
          onLeaving={onLeaving}
          onItemDragMove={onItemDragMove}
          onItemDragEnd={onItemDragEnd}
          onDragOutside={dragOutOfWindow}
          onDragCancel={resetHandover}
        />
      )}
    </>
  );
}
