import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { api, type Config, type FolderEntry, type Item } from "../../shared/api/ApiModel";
import { TUNING } from "../../shared/api/TuningModel";
import { shiftDown } from "../../shared/drag/ShiftKeyController";
import { t } from "../../shared/i18n/i18n";
import { makeEdgeFlipper, type PagerApi } from "../../shared/ui/Pager";
import { type Origin } from "../folders/FolderModel";
import { type Snapshot, type HistoryAction } from "../history/useUndoHistory";
import { HOME_ORDER_KEY, clampSlot, entryKey, folderUnderPoint, insertClamped, type HomeEntry } from "./HomeModel";

/**
 * ホームとフォルダ内の間で、アイコンをドラッグして受け渡す(スマートフォンのホーム画面と同じ)。
 *  ホーム → フォルダ: フォルダの上で止めるとフォルダが開く。そのままフォルダ内の好きな位置で離すと、そこに入る
 *  フォルダ内 → ホーム: フォルダの枠の外へ出して止めるとフォルダ内の画面が薄くなる。ホームの好きな位置で離すと、そこに置かれる
 * ドラッグの途中の状態(持ち込み中のアイコン・持ち出し中か・置く位置の空き)と、それを片付ける処理も持つ。
 * @param stateRef 最新の `open`(開いているフォルダ)と設定を読むための参照
 * @param configRef 常に最新の設定
 * @param launcherRef ホームのアイコンの保存先(launcherFolder)のパス
 * @param entriesRef いまのホームの並び
 * @param open 開いているフォルダ
 * @param setOpen フォルダを開く/閉じる
 * @param mutate 最新の設定に変更を適用して保存する関数
 * @param flash 画面に一言出す関数
 * @param bumpFolder そのフォルダの一覧を取り直させる関数
 * @param flushReorder・snapshot・restoreSnapshot・pushHistory 元に戻す履歴の関数(`useUndoHistory`)
 * @returns 受け渡しの状態と、ホーム・フォルダ内のドラッグから呼ぶ関数
 */
export function useDragHandover({
  stateRef,
  configRef,
  launcherRef,
  entriesRef,
  open,
  setOpen,
  mutate,
  flash,
  bumpFolder,
  flushReorder,
  snapshot,
  restoreSnapshot,
  pushHistory,
}: {
  stateRef: MutableRefObject<{ open: { folder: FolderEntry; origin: Origin } | null; config: Config | null }>;
  configRef: MutableRefObject<Config | null>;
  launcherRef: MutableRefObject<string>;
  entriesRef: MutableRefObject<HomeEntry[]>;
  open: { folder: FolderEntry; origin: Origin } | null;
  setOpen: Dispatch<SetStateAction<{ folder: FolderEntry; origin: Origin } | null>>;
  mutate: (fn: (c: Config) => Config) => void;
  flash: (msg: string) => void;
  bumpFolder: (path: string) => void;
  flushReorder: () => void;
  snapshot: () => Snapshot;
  restoreSnapshot: (s: Snapshot) => void;
  pushHistory: (a: HistoryAction) => void;
}) {
  const [homeSlot, setHomeSlot] = useState<number | null>(null);
  /** ドラッグの受け渡しの途中(ホームへ持ち出し中・フォルダへ持ち込み中)の状態を片付ける。片付けないと、アプリの外へ出して戻ったときや、スクリーンショットでフォーカスが外れたときに「持ち出し中」のまま残り、フォルダが開けなくなる。 */
  const resetHandover = () => {
    clearTimeout(outsideSheetTimer.current);
    outsideSheetTimer.current = undefined;
    homeFlipper.stop();
    markFolderTarget(null);
    homeSlotRef.current = null;
    setHomeSlot(null);
    setLeaving(false);
    if (dragInRef.current) {
      setDragIn(null);
      setOpen(null);
    }
  };

  // ---- ホームとフォルダ内の間で、アイコンをドラッグして受け渡す(スマートフォンのホーム画面と同じ) ----
  //  ホーム → フォルダ: フォルダの上で止めるとフォルダが開く。そのままフォルダ内の好きな位置で離すと、そこに入る
  //  フォルダ内 → ホーム: フォルダの枠の外へ出して止めるとフォルダ内の画面が薄くなる。ホームの好きな位置で離すと、そこに置かれる
  const [dragIn, setDragIn] = useState<Item | null>(null);
  const dragInRef = useRef<Item | null>(null);
  dragInRef.current = dragIn;
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);
  leavingRef.current = leaving;
  const homeSlotRef = useRef<number | null>(null);
  const pointerSubs = useRef(new Set<(x: number, y: number) => void>());
  /**
   * ホーム側のドラッグの座標を受け取る(ホームのアイコンをフォルダへ入れる間、フォルダ内の画面が使う)。
   * @param fn 座標を受け取る関数
   * @returns 解除する関数
   */
  const subscribePointer = useCallback((fn: (x: number, y: number) => void) => {
    pointerSubs.current.add(fn);
    return () => void pointerSubs.current.delete(fn);
  }, []);
  const dropInfoRef = useRef<{ index: number | null; paths: string[] }>({ index: null, paths: [] });
  const outsideSheetTimer = useRef<number>();

  /** 画面の座標が、フォルダの枠の中か。 */
  const insideSheet = (x: number, y: number) => {
    const r = document.querySelector(".sheet")?.getBoundingClientRect();
    return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };

  /**
   * ホームのアイコンを、フォルダの上に重ねて止めた: フォルダを開く(ドラッグは続く)。
   * @param dragKey ドラッグ中のアイコン
   * @param targetKey 重ねたフォルダ
   * @returns 処理したなら `true`
   */
  const onMergeReady = (dragKey: string, targetKey: string): boolean => {
    if (!dragKey.startsWith("i:") || !targetKey.startsWith("f:")) return false;
    const folder = configRef.current?.folders.find((f) => `f:${f.id}` === targetKey);
    const entry = entriesRef.current.find((e) => e.kind === "item" && entryKey(e) === dragKey);
    if (!folder || !entry || entry.kind !== "item") return false;
    const r = document.querySelector(`.home .cell[data-id="${CSS.escape(targetKey)}"]`)?.getBoundingClientRect();
    dropInfoRef.current = { index: null, paths: [] };
    setDragIn(entry.item);
    setOpen({
      folder,
      origin: {
        x: r ? r.left + r.width / 2 : window.innerWidth / 2,
        y: r ? r.top + r.height / 2 : window.innerHeight / 2,
      },
    });
    return true;
  };

  /** ホームのアイコンをドラッグして動かしている間。フォルダ内の画面へ座標を知らせ、フォルダの外に `closeOutsideMs` いたら、フォルダを閉じる(入れるのをやめる)。 */
  const onHomeDragMove = (_key: string, x: number, y: number) => {
    pointerSubs.current.forEach((f) => f(x, y));
    if (!dragInRef.current) return;
    if (insideSheet(x, y)) {
      clearTimeout(outsideSheetTimer.current);
      outsideSheetTimer.current = undefined;
    } else if (outsideSheetTimer.current === undefined) {
      // フォルダの外にしばらくいたら、フォルダを閉じる(入れるのをやめる)
      outsideSheetTimer.current = window.setTimeout(() => {
        outsideSheetTimer.current = undefined;
        setDragIn(null);
        setOpen(null);
      }, TUNING.closeOutsideMs);
    }
  };

  /**
   * ホームのアイコンを、フォルダ内の離した位置へ移動する(元に戻せる)。
   * @param item 移すアイコン
   * @param folder 移動先のフォルダ
   * @param index 入れる位置
   * @param paths いまのフォルダ内の並び(パスの一覧)
   */
  const moveIntoFolderAt = async (item: Item, folder: FolderEntry, index: number, paths: string[]) => {
    const home = launcherRef.current;
    try {
      let cur = await api.moveItem(item.path, folder.path);
      flushReorder();
      const before = snapshot();
      const next = insertClamped(paths, index, cur);
      mutate((c) => ({ ...c, orders: { ...c.orders, [folder.id]: next } }));
      const after = snapshot();
      pushHistory({
        undo: async () => {
          cur = await api.moveItem(cur, home);
          restoreSnapshot(before);
        },
        redo: async () => {
          cur = await api.moveItem(cur, folder.path);
          restoreSnapshot(after);
        },
      });
      bumpFolder(home);
      bumpFolder(folder.path);
      flash(t("addedFiles", { n: 1, name: folder.name }));
    } catch (err) {
      flash(t("moveFailed", { err: String(err) }));
    }
  };

  /**
   * ホームのアイコンのドラッグを離したとき(フォルダへ持ち込み中のとき)。フォルダの枠の中で離したら、その位置に入れる。外で離したら、入れずに、フォルダを閉じる。
   * @returns 処理したなら `true`
   */
  const onHomeDragEnd = (_key: string, x: number, y: number): boolean => {
    const item = dragInRef.current;
    if (!item) return false;
    clearTimeout(outsideSheetTimer.current);
    outsideSheetTimer.current = undefined;
    setDragIn(null);
    const folder = stateRef.current.open?.folder;
    if (folder && insideSheet(x, y)) {
      const info = dropInfoRef.current;
      moveIntoFolderAt(item, folder, info.index ?? info.paths.length, info.paths);
    } else {
      setOpen(null); // フォルダの外で離した: 入れずに、フォルダを閉じる
    }
    return true;
  };

  /** ホームの中で、ポインタの下のマスの番号を返す関数(`Pager` が入れる)。 */
  const homeSlotAt = useRef<((x: number, y: number) => number | null) | null>(null);
  const homePagerApi = useRef<PagerApi | null>(null);
  const homeFlipper = useMemo(() => makeEdgeFlipper(() => homePagerApi.current), []);
  /**
   * ホームの中で、ポインタに一番近い位置(何番目に置くか)を求める。
   * @param x 画面の x 座標
   * @param y 画面の y 座標
   */
  const computeHomeSlot = (x: number, y: number): number => {
    return clampSlot(homeSlotAt.current?.(x, y), entriesRef.current.length);
  };

  /**
   * ホームへ持ち出している間、ポインタが中央に乗っている「別のフォルダ」(そのまま入れられる)を探す。
   * @returns フォルダの ID と要素。なければ `null`
   */
  const homeFolderUnder = (x: number, y: number): { id: string; el: HTMLElement } | null => {
    const cells = [...document.querySelectorAll<HTMLElement>(`.home .cell[data-id^="f:"]`)];
    const rects = cells.map((el) => {
      const r = el.getBoundingClientRect();
      return { id: (el.dataset.id ?? "").slice(2), left: r.left, top: r.top, width: r.width, height: r.height };
    });
    const hit = folderUnderPoint(rects, x, y, TUNING.folderZone, stateRef.current.open?.folder.id);
    return hit ? { id: hit.id, el: cells[rects.indexOf(hit)] } : null;
  };
  /** 「このフォルダへ入れる」の強調表示を、指定のフォルダだけに付ける(`null` で全部消す)。 */
  const markFolderTarget = (el: HTMLElement | null) => {
    document
      .querySelectorAll(".home .cell.merge.xfolder")
      .forEach((n) => n !== el && n.classList.remove("merge", "xfolder"));
    el?.classList.add("merge", "xfolder");
  };

  /** フォルダ内のアイコンを動かしている間。ホームへ持ち出している間は、ホームのページ送りと、置く位置の空き(または、別のフォルダへ入れる強調)を動かす。Shift 中は、ページ送りと空きの移動を止める(別のフォルダへ入れる操作だけ使える)。 */
  const onItemDragMove = (x: number, y: number) => {
    if (shiftDown()) {
      // Shift 中は、ページ送りも、置く位置の空き(ほかのアイコンのよけ)も動かさない
      homeFlipper.stop();
      if (leavingRef.current) markFolderTarget(homeFolderUnder(x, y)?.el ?? null); // 別のフォルダへ入れる操作は、Shift 中も使える
      return;
    }
    homeFlipper.feed(x, y, leavingRef.current); // ホームへ持ち出している間は、ホームの ▷ ◁ でもページを送れる
    if (!leavingRef.current) return;
    const under = homeFolderUnder(x, y);
    markFolderTarget(under?.el ?? null);
    if (under) return; // 別のフォルダの上: 置く位置の空きは動かさない
    const idx = computeHomeSlot(x, y);
    homeSlotRef.current = idx;
    setHomeSlot((p) => (p === idx ? p : idx));
  };

  /**
   * フォルダ内のアイコンを、ホームの離した位置へ移動する(元に戻せる)。
   * @param item 移すアイコン
   * @param slot 置く位置(`null` は、一番後ろ)
   */
  const moveToHomeAt = async (item: Item, slot: number | null) => {
    const openFolder = stateRef.current.open?.folder;
    const home = launcherRef.current;
    if (!openFolder || !home) return;
    try {
      let cur = await api.moveItem(item.path, home);
      flushReorder();
      const before = snapshot();
      const keys = insertClamped(entriesRef.current.map(entryKey), slot, `i:${cur}`);
      mutate((c) => ({ ...c, orders: { ...c.orders, [HOME_ORDER_KEY]: keys } }));
      const after = snapshot();
      pushHistory({
        undo: async () => {
          cur = await api.moveItem(cur, openFolder.path);
          restoreSnapshot(before);
        },
        redo: async () => {
          cur = await api.moveItem(cur, home);
          restoreSnapshot(after);
        },
      });
      bumpFolder(openFolder.path);
      bumpFolder(home);
      flash(t("movedToHome", { name: item.name }));
    } catch (err) {
      flash(t("moveFailed", { err: String(err) }));
    }
  };

  /**
   * フォルダ内のアイコンを、ホームにある別のフォルダへ直接移動する(一番後ろに入る。元に戻せる)。
   * @param item 移すアイコン
   * @param target 移動先のフォルダ
   */
  const moveToOtherFolder = async (item: Item, target: FolderEntry) => {
    const from = stateRef.current.open?.folder;
    if (!from) return;
    try {
      let cur = await api.moveItem(item.path, target.path);
      flushReorder();
      pushHistory({
        undo: async () => void (cur = await api.moveItem(cur, from.path)),
        redo: async () => void (cur = await api.moveItem(cur, target.path)),
      });
      bumpFolder(from.path);
      bumpFolder(target.path);
      flash(t("addedFiles", { n: 1, name: target.name }));
    } catch (err) {
      flash(t("moveFailed", { err: String(err) }));
    }
  };

  /**
   * フォルダ内のアイコンのドラッグを、枠の外で離したとき。別のフォルダの上なら、そのフォルダへ。そうでなければ、ホームの離した位置へ移し、フォルダ内の画面は閉じる。
   * @returns 処理したので `true`
   */
  const onItemDragEnd = (item: Item, x: number, y: number): boolean => {
    homeFlipper.stop();
    const under = leavingRef.current ? homeFolderUnder(x, y) : null;
    markFolderTarget(null);
    const slot = homeSlotRef.current;
    homeSlotRef.current = null;
    setHomeSlot(null);
    setLeaving(false);
    const targetFolder = under ? configRef.current?.folders.find((f) => f.id === under.id) : undefined;
    if (targetFolder) moveToOtherFolder(item, targetFolder);
    else moveToHomeAt(item, slot);
    setOpen(null); // ホームへ置いたので、フォルダ内の画面は閉じる
    return true;
  };

  // フォルダ内の画面が閉じたら、受け渡しの状態を片付ける
  useEffect(() => {
    if (open) return;
    markFolderTarget(null);
    homeFlipper.stop();
    setLeaving(false);
    setHomeSlot(null);
    homeSlotRef.current = null;
    setDragIn(null);
  }, [open, homeFlipper]); // homeFlipper は、作り直されない(useMemo の依存が空)ので、依存に入れても、実行は増えない

  /**
   * フォルダ内のアイコンを、枠の外へ持ち出している(薄くなった)かが変わったとき。持ち出しをやめたら、ホームの置く位置の空きも片付ける。
   * @param b 持ち出している間は `true`
   */
  const onLeaving = (b: boolean) => {
    setLeaving(b);
    if (!b) {
      homeSlotRef.current = null;
      setHomeSlot(null);
    }
  };

  return {
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
  };
}
