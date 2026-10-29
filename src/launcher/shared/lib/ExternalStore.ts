/**
 * `useSyncExternalStore` で画面の部品から使う、状態の入れ物の土台。状態の「写し」(`S`)を持ち、`emit()` で作り直して、購読している部品へ知らせる。
 * 写しは、`emit()` するまで同じ値を返す(`useSyncExternalStore` が、描き直しを減らせるように)。使う側は、`compute()` で写しの作り方を決め、作ったあとの最後に `init()` を呼ぶ。
 * @typeParam S 状態の写しの型
 */
export abstract class ExternalStore<S> {
  private snap!: S;
  private listeners = new Set<() => void>();

  /** いまの状態から、外へ渡す写しを作る。 */
  protected abstract compute(): S;

  /** 最初の写しを作る(使う側のコンストラクタの最後で呼ぶ)。 */
  protected init() {
    this.snap = this.compute();
  }
  /** 状態の写しを作り直して、購読している部品へ知らせる。 */
  protected emit() {
    this.snap = this.compute();
    this.listeners.forEach((f) => f());
  }
  /** いまの状態の写しを返す(`useSyncExternalStore` 用。`emit()` するまで同じ値を返す)。 */
  getState = () => this.snap;
  /**
   * 状態の変化を購読する。
   * @param f 変わったときに呼ばれる関数
   * @returns 購読を解除する関数
   */
  subscribe = (f: () => void) => {
    this.listeners.add(f);
    return () => this.listeners.delete(f);
  };
}
