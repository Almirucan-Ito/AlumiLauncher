// ---- リール ----
var reelEls = [].slice.call(document.querySelectorAll(".reel:not(.reachTxt)")),
  reels = [];
/** リール 1 つの高さ(px)。 */
function H() {
  return reelEls[0].clientHeight;
}
reelEls.forEach(function (el, i) {
  var slots = [];
  for (var k = 0; k < 4; k++) {
    var s = document.createElement("div");
    s.className = "slot";
    el.appendChild(s);
    slots.push(s);
  }
  reels.push({ el: el, slots: slots, pos: i * 2, speed: 0, target: null, done: null });
});
/**
 * リールの 1 コマ(スロット)に、図柄を出す(変わるときだけ書き換える)。
 * @param s コマの要素
 * @param idx 図柄の番号(範囲の外は、回り込む)
 */
function setSym(s, idx) {
  var y = SYMS[((idx % SYMS.length) + SYMS.length) % SYMS.length];
  if (s._y !== y) {
    s._y = y;
    s.textContent = y;
    s.style.color = SCOL[y];
  }
}
/**
 * リールを描く。いまの位置(小数)から、見える 4 コマの図柄と、縦のずれを決める。
 * @param r リール
 */
function drawReel(r) {
  var h = H(),
    b = Math.floor(r.pos),
    f = r.pos - b;
  for (var k = 0; k < 4; k++) {
    var s = r.slots[k];
    s.style.height = h + "px";
    setSym(s, b + k - 1);
    s.style.transform = "translateY(" + (k - 1 - f) * h + "px)";
  }
}
/** 図柄の番号を求める。 */
function symIndex(sym) {
  return SYMS.indexOf(sym);
}
/**
 * リールの図柄を、すぐに(回さずに)決める。
 * @param i リールの番号(0〜2)
 * @param sym 図柄
 */
function setReel(i, sym) {
  reels[i].pos = symIndex(sym) + SYMS.length * 3;
  drawReel(reels[i]);
}
var spinning = false,
  last = 0,
  quiet = false;
/**
 * リールを 1 コマ進める(画面の更新ごとに呼ぶ)。回っているリールは速さぶん進め、止めるように頼まれたリールは、目標の位置まで、だんだん遅くして近づける。
 * @param t 時刻(ミリ秒)
 */
function tickReels(t) {
  if (!spinning) return;
  var dt = Math.min(50, t - last) / 1000;
  last = t;
  reels.forEach(function (r) {
    if (r.target == null) {
      r.pos += r.speed * dt;
    } else {
      var a = r.target;
      if (a.t0 == null) a.t0 = t;
      var k = Math.min(1, (t - a.t0) / a.dur),
        e = 1 - Math.pow(1 - k, 3);
      r.pos = a.from + (a.to - a.from) * e;
      if (k >= 1) finishStop(r);
    }
    drawReel(r);
  });
  if (
    reels.some(function (r) {
      return r.speed > 0 || r.target;
    })
  )
    requestAnimationFrame(tickReels);
  else spinning = false;
}
/**
 * リールが止まったときの後始末(位置を確定し、止まる音と、待っている処理を呼ぶ)。
 * @param r リール
 */
function finishStop(r) {
  if (!r.target) return;
  r.pos = r.target.to;
  r.target = null;
  r.speed = 0;
  var d = r.done;
  r.done = null;
  if (!quiet) {
    try {
      SE.stop();
    } catch (e) {}
  }
  d && d();
}
/** 3 つのリールを回し始める。 */
function startReels() {
  spinning = true;
  last = performance.now();
  reels.forEach(function (r) {
    r.speed = st.turbo ? 36 : 24;
    r.target = null;
  });
  requestAnimationFrame(tickReels);
}
/**
 * リールを止めるように頼む。目標の図柄が、いまの位置の少し先(2 周以上先)で止まるようにする。画面が隠れていて描画が止まっても、`dur`+0.9 秒後には、必ず止める。
 * @param i リールの番号
 * @param sym 止める図柄
 * @param dur 止まるまでの時間(ミリ秒)
 * @param cb 止まったとき
 */
function stopReel(i, sym, dur, cb) {
  var r = reels[i],
    cur = r.pos,
    n = SYMS.length,
    want = symIndex(sym),
    to = Math.ceil(cur) + n * 2;
  to += (want - (to % n) + n) % n;
  r.speed = 1;
  r.target = { from: cur, to: to, dur: dur, t0: null };
  r.done = cb;
  if (!spinning) {
    spinning = true;
    last = performance.now();
    requestAnimationFrame(tickReels);
  }
  setTimeout(function () {
    if (r.target && r.target.to === to) {
      finishStop(r);
      drawReel(r);
    }
  }, dur + 900);
} // 画面が隠れていて描画が止まっても、止める
/**
 * 待つ(TURBO のときは、半分の時間)。
 * @param ms ミリ秒
 */
function wait(ms) {
  return new Promise(function (r) {
    setTimeout(r, st.turbo ? ms * 0.5 : ms);
  });
}
/**
 * 待つ(TURBO でも、時間を変えない)。
 * @param ms ミリ秒
 */
function waitRaw(ms) {
  return new Promise(function (r) {
    setTimeout(r, ms);
  });
}
