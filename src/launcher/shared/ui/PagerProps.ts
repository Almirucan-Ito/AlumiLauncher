import { type ReactNode } from "react";
import { type PagerApi, type PagerLayout } from "./PagerModel";

/** `Pager` に渡す値。ドラッグ操作(並べ替え・重ねてフォルダ作成・フォルダ内との受け渡し・ウィンドウ外へのドラッグ)の窓口を、コールバックとして受け取る。 */
export interface PagerProps<T> {
  items: T[];
  render: (item: T) => ReactNode;
  layout: PagerLayout;
  /** 矢印キーでのページ送りを有効にするか */
  keyboard?: boolean;
  className?: string;
  /** 並べ替え可能なアイテムのID。null/未指定なら並べ替え対象外 */
  getId?: (item: T) => string | null;
  /** 長押しドラッグで並びが変わったときに新しい並びを返す */
  onReorder?: (items: T[]) => void;
  /** ドラッグ中のアイコンを、別のアイコンの上に重ねられるか(フォルダ作成・フォルダへ移動) */
  canDropOnto?: (dragId: string, targetId: string) => boolean;
  /** 重ねる範囲(マスの中央からの半分の幅の割合)を、相手ごとに変える。省略時は TUNING.centerZone */
  mergeZone?: (dragId: string, targetId: string) => number;
  /** ドラッグが、ドロップされないまま途切れた(スクリーンショットなどでウィンドウのフォーカスが外れた)。受け渡しの途中の状態を片付ける */
  onDragCancel?: () => void;
  /**
   * 別のアイコンの上に重ねて離したとき。ready=true は、重ねて待つ時間が過ぎていたとき
   * (false は、中央に重ねてすぐ離したとき)
   */
  onDropOnto?: (dragId: string, targetId: string, ready: boolean) => void;
  /**
   * 画面の座標(x, y)が、この一覧の何番目のマスの上かを返す関数をここへ入れる(一覧の外なら null)。
   * 動いている最中のアイコンの位置ではなく、マスの並び(グリッド)から計算するので、アニメーション中でも値がぶれない
   */
  slotRef?: React.MutableRefObject<((x: number, y: number) => number | null) | null>;
  /** 中央に重ねてすぐ離すだけで入る相手か(true なら、重ねた瞬間に「入る」ことが分かる強い表示にする) */
  quickDrop?: (dragId: string, targetId: string) => boolean;
  /** 外部(別の一覧からのドラッグ)からページを送るための窓口 */
  apiRef?: React.MutableRefObject<PagerApi | null>;
  /**
   * 重ねて待つ時間が過ぎたとき。true を返すと、この一覧は「重ねる」状態にしない(呼び出し側が処理済み。
   * 例: フォルダに重ねたまま止めると、フォルダを開く)
   */
  onMergeReady?: (dragId: string, targetId: string) => boolean;
  /** ドラッグ中のアイコンが動いたとき(座標は画面の座標)。別の一覧(フォルダ内など)との受け渡しに使う */
  onDragMove?: (dragId: string, x: number, y: number) => void;
  /**
   * ドラッグ中のアイコンが、ウィンドウの外へ出たとき(デスクトップやエクスプローラーのフォルダへ移すため)。
   * true を返すと、呼び出し側が OS 標準のドラッグに切り替えたので、この一覧のドラッグは終わる
   */
  onDragOutside?: (dragId: string) => boolean;
  /** ドラッグしたアイコンを離したとき。true を返すと、呼び出し側が処理したので、この一覧は何もしない */
  onDragEnd?: (dragId: string, x: number, y: number) => boolean;
  /** 長押ししてドラッグできるようになるまでの時間(ms) */
  dragDelayMs?: number;
  /** 別のアイコンに重ねて止めてから、重ねられる状態になるまでの時間(ms) */
  mergeDelayMs?: number;
}
