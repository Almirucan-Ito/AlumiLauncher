import { clamp01 } from "../lib/MathUtil";

/** 合図(beep)の音量(0〜1)。設定の「音量」に合わせる(App が、設定が変わるたびに渡す)。 */
let beepVolume = 1;

/**
 * 合図の音量を決める。
 * @param v 0〜1
 */
export function setBeepVolume(v: number) {
  beepVolume = clamp01(v);
}

/** 終わりの合図(短い 3 音のチャイム)を鳴らす。音源ファイルは使わず、その場で作った単純な正弦波なので、著作権・ライセンスの問題がない。音が出せない環境では、何もしない。アラームやタイマーの終わりに使う。 */
export function beep() {
  if (beepVolume <= 0) return;
  try {
    const ctx = new AudioContext();
    [
      [0, 784],
      [0.18, 988],
      [0.36, 1319],
    ].forEach(([at, hz]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = hz;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.18 * beepVolume), ctx.currentTime + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.6);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + at);
      o.stop(ctx.currentTime + at + 0.65);
    });
    setTimeout(() => ctx.close(), 1800);
  } catch {
    /* 音は出なくてもよい */
  }
}
