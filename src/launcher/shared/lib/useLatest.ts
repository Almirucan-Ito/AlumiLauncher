import { useRef, type MutableRefObject } from "react";

/**
 * 毎回の描画で、最新の値を入れ直す参照を返す。
 * イベントの購読(`window.addEventListener` など)を、描画のたびにやり直さずに、中では、いつでも最新の値を使いたいときに使う(購読は、返した参照だけを依存にして、一度だけ行う)。
 * @param value 最新の値(関数でもよい)
 * @returns `current` に、最新の値が入っている参照(参照そのものは、変わらない)
 */
export function useLatest<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
