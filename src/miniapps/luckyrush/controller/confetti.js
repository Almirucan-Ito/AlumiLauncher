// ---- 紙吹雪(コイン) ----
var cv = $("fx"),
  cx = cv.getContext("2d"),
  parts = [],
  raf = 0;
/** 紙吹雪を描く画面(canvas)の大きさを、ウィンドウに合わせる(高解像度の画面にも対応)。 */
function fit() {
  cv.width = innerWidth * devicePixelRatio;
  cv.height = innerHeight * devicePixelRatio;
  cx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
addEventListener("resize", fit);
fit();
/**
 * 金色のコイン(紙吹雪)を、まとめて飛ばす。
 * @param n 個数
 * @param y 飛ばし始める高さ(省略時は、画面の中ほど)
 */
function burst(n, y) {
  var w = innerWidth;
  for (var i = 0; i < n; i++) {
    var a = Math.random() * Math.PI * 2,
      s = 3 + Math.random() * 9;
    parts.push({
      x: w / 2 + (Math.random() - 0.5) * w * 0.4,
      y: y || innerHeight * 0.45,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 5,
      r: 3 + Math.random() * 4,
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 0.4,
      life: 60 + Math.random() * 50,
      c: ["#ffd24a", "#ffb300", "#fff2a8", "#ff6b8f", "#ff9d00"][i % 5],
    });
  }
  if (!raf) raf = requestAnimationFrame(loop);
}
/** 紙吹雪を 1 コマ進めて描く(重力・減速・回転・薄れ)。粒がある間だけ、続ける。 */
function loop() {
  cx.clearRect(0, 0, innerWidth, innerHeight);
  for (var i = parts.length - 1; i >= 0; i--) {
    var p = parts[i];
    p.vy += 0.28;
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.99;
    p.rot += p.vr;
    p.life--;
    if (p.life <= 0 || p.y > innerHeight + 20) {
      parts.splice(i, 1);
      continue;
    }
    cx.save();
    cx.translate(p.x, p.y);
    cx.rotate(p.rot);
    cx.globalAlpha = Math.min(1, p.life / 30);
    cx.fillStyle = p.c;
    cx.beginPath();
    cx.ellipse(0, 0, p.r, p.r * Math.abs(Math.cos(p.rot * 2)) + 0.6, 0, 0, 6.283);
    cx.fill();
    cx.restore();
  }
  raf = parts.length ? requestAnimationFrame(loop) : 0;
  if (!raf) cx.clearRect(0, 0, innerWidth, innerHeight);
}
