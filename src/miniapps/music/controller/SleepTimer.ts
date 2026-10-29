/** おやすみタイマー(指定した時間がたつと、決めておいた処理を行う。プレーヤーでは、一時停止)。 */
export class SleepTimer {
  private at: number | null = null;
  private timer: number | undefined;

  /** 残り時間(秒)。タイマーが無ければ `null`。 */
  left(): number | null {
    return this.at === null ? null : Math.max(0, Math.ceil((this.at - Date.now()) / 1000));
  }
  /**
   * タイマーを決める(前のタイマーは取り消す)。
   * @param min 分。0 または `null` で解除
   * @param onFire 時間がたったときの処理
   */
  set(min: number | null, onFire: () => void) {
    clearTimeout(this.timer);
    if (!min || min <= 0) {
      this.at = null;
      return;
    }
    this.at = Date.now() + min * 60_000;
    this.timer = window.setTimeout(() => {
      this.at = null;
      onFire();
    }, min * 60_000);
  }
}
