import { useEffect, useRef, type MutableRefObject } from "react";
import { type Config, type FolderEntry } from "../../shared/api/ApiModel";
import { t } from "../../shared/i18n/i18n";
import { useLatest } from "../../shared/lib/useLatest";

/** 元に戻す/やり直しのために覚える、フォルダ一覧と並び順の写し。 */
export type Snapshot = { folders: FolderEntry[]; orders: Record<string, string[]> };
/** 元に戻せる操作 1 つ(元に戻す処理 `undo` と、やり直す処理 `redo`)。 */
export type HistoryAction = { undo: () => Promise<void> | void; redo: () => Promise<void> | void };
/** 元に戻す/やり直しの履歴の上限。 */
const MAX_HISTORY = 5;

/**
 * 元に戻す(Ctrl+Z)/ やり直し(Ctrl+Y)。どちらも最大 5 件まで保持する。
 * 対象: 並べ替え・フォルダの作成/名前変更/一覧から外す・アイコンの移動(ファイルの移動も元に戻す)。対象外: 設定の変更、ファイルの追加、ごみ箱への削除。
 * @param configRef 常に最新の設定(フォルダ一覧と並び順の写しを作るのに使う)
 * @param mutate 最新の設定に変更を適用して保存する関数
 * @param onRestored 元に戻す/やり直しを実行したあと(一覧を取り直す)
 * @param flash 画面に一言出す関数
 * @returns 履歴を扱う関数(`snapshot`・`restoreSnapshot`・`pushHistory`・`flushReorder`・`reorderRecorded`・`recorded`)
 */
export function useUndoHistory({
  configRef,
  mutate,
  onRestored,
  flash,
}: {
  configRef: MutableRefObject<Config | null>;
  mutate: (fn: (c: Config) => Config) => void;
  onRestored: () => void;
  flash: (msg: string) => void;
}) {
  const undoStack = useRef<HistoryAction[]>([]);
  const redoStack = useRef<HistoryAction[]>([]);
  const historyBusy = useRef(false);

  /** いまのフォルダ一覧と並び順の写しを作る。 */
  const snapshot = (): Snapshot => ({
    folders: configRef.current?.folders ?? [],
    orders: configRef.current?.orders ?? {},
  });
  /**
   * 写しの内容へ、フォルダ一覧と並び順を戻す。
   * @param s 戻す写し
   */
  const restoreSnapshot = (s: Snapshot) => mutate((c) => ({ ...c, folders: s.folders, orders: s.orders }));
  /**
   * 元に戻せる操作を、履歴に足す(新しい操作をしたら、やり直しの履歴は捨てる)。
   * @param a 操作
   */
  const pushHistory = (a: HistoryAction) => {
    undoStack.current = [...undoStack.current, a].slice(-MAX_HISTORY);
    redoStack.current = []; // 新しい操作をしたら、やり直しの履歴は捨てる
  };

  /** 履歴を全部捨てる(プリセットを切り替えたときなど、表示する内容が入れ替わるとき)。 */
  const clearHistory = () => {
    undoStack.current = [];
    redoStack.current = [];
  };

  // ドラッグ中の並べ替えは入れ替えのたびに呼ばれるので、続けて起きた分を「1回の操作」にまとめる
  /** ドラッグ中の並べ替えは、入れ替えのたびに呼ばれるので、続けて起きた分を「1 回の操作」にまとめるための記録(始める前の写しと、確定のタイマー)。 */
  const reorderBurst = useRef<{ before: Snapshot; timer: number } | null>(null);
  /** まとめていた並べ替えを、1 回の操作として、履歴へ確定する。 */
  const flushReorder = () => {
    const b = reorderBurst.current;
    if (!b) return;
    clearTimeout(b.timer);
    reorderBurst.current = null;
    const after = snapshot();
    pushHistory({ undo: () => restoreSnapshot(b.before), redo: () => restoreSnapshot(after) });
  };
  /**
   * 並べ替えを実行して、履歴にまとめる(最後の入れ替えから 1.2 秒たつと、1 回の操作として確定)。
   * @param apply 並べ替えを行う処理
   */
  const reorderRecorded = (apply: () => void) => {
    if (!reorderBurst.current) reorderBurst.current = { before: snapshot(), timer: 0 };
    apply();
    clearTimeout(reorderBurst.current.timer);
    reorderBurst.current.timer = window.setTimeout(flushReorder, 1200);
  };
  /**
   * 設定上の変更(フォルダ・並び順)を、元に戻せる操作として実行する。
   * @param apply 変更を行う処理
   */
  const recorded = (apply: () => void) => {
    flushReorder();
    const before = snapshot();
    apply();
    const after = snapshot();
    pushHistory({ undo: () => restoreSnapshot(before), redo: () => restoreSnapshot(after) });
  };

  /**
   * 元に戻す/やり直しを 1 回実行する。実行中は、次の操作を受け付けない。失敗したら、履歴に戻す。
   * @param kind `"undo"` か `"redo"`
   */
  const runHistory = async (kind: "undo" | "redo") => {
    flushReorder();
    if (historyBusy.current) return;
    const from = kind === "undo" ? undoStack : redoStack;
    const to = kind === "undo" ? redoStack : undoStack;
    const action = from.current.pop();
    if (!action) return;
    historyBusy.current = true;
    try {
      await action[kind]();
      to.current = [...to.current, action].slice(-MAX_HISTORY);
      onRestored();
      flash(t(kind === "undo" ? "undone" : "redone"));
    } catch (err) {
      from.current.push(action); // 失敗したら履歴に戻す
      flash(t("moveFailed", { err: String(err) }));
    } finally {
      historyBusy.current = false;
    }
  };

  // キーの購読は一度だけ行い、中では、いつも最新の `runHistory` を呼ぶ
  const runHistoryRef = useLatest(runHistory);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return; // 入力欄では、入力の取り消しを妨げない
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        runHistoryRef.current("undo");
      } else if (k === "y" || (k === "z" && e.shiftKey)) {
        e.preventDefault();
        runHistoryRef.current("redo");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [runHistoryRef]);

  return { snapshot, restoreSnapshot, pushHistory, clearHistory, flushReorder, reorderRecorded, recorded };
}
