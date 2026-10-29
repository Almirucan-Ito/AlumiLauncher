// フリーズ: 色(虹以外)で回り、いったんハズレに見えたあと、不穏な鐘の音の中、ゆっくり回りだして次第に速くなり、しばらくして派手な音とともに虹色で当たり確定(RUSH 中は起きない)
/**
 * フリーズ中の、不穏な音(うなる低い音と、倍音のずれた鐘)を、時間とともに大きくしながら鳴らし続ける。
 * @returns 鳴らすのを止める関数
 */
function freezeAmbience() {
  var k = 0,
    id = setInterval(function () {
      try {
        var g = Math.min(k, 8),
          v = 0.07 + g * 0.012;
        tone(110, 0, 1.1, "sine", v * 1.6);
        tone(116.5, 0, 1.1, "sine", v * 1.2);
        tone(55, 0, 1.2, "triangle", v * 1.4); // うなる低い音
        if (k % 2 === 1) {
          [660, 1820, 3564].forEach(function (f, i) {
            tone(f * (1 + g * 0.004), 0, 1.2, "sine", v * (0.8 / (i + 1)));
          });
        } // 鐘(倍音がずれた、金属っぽい音)
        if (k % 3 === 2) tone(880 * Math.pow(1.05, g), 0.2, 0.5, "triangle", v * 0.7);
        k++;
      } catch (e) {}
    }, 600);
  return function () {
    clearInterval(id);
  };
}
/**
 * フリーズ演出の続き: 色(虹以外)で回り、いったんハズレに見えたあと、不穏な音の中、ゆっくり回りだして次第に速くなり、しばらくして、派手な音とともに虹色で当たりが確定する(7・7・7)。
 * @returns 必ず `true`(当たり)
 */
async function freezeRest() {
  var a = pick(),
    b = pickOther(a),
    rest = SYMS.filter(function (x) {
      return x !== a && x !== b;
    }),
    c = rest[Math.floor(Math.random() * rest.length)];
  await new Promise(function (ok) {
    stopReel(0, a, 420, ok);
  });
  await wait(200);
  await new Promise(function (ok) {
    stopReel(2, b, 420, ok);
  });
  await new Promise(function (ok) {
    stopReel(1, c, 520, ok);
  });
  await wait(200);
  fxColor(-1);
  await waitRaw(900);
  quiet = true;
  document.body.classList.add("freezing");
  startReels();
  reels.forEach(function (r) {
    r.speed = 1.5;
  }); // 最初は、ゆっくり回りだす
  var stopAmb = freezeAmbience(),
    t0 = performance.now();
  var ramp = setInterval(function () {
    var k = Math.min(1, (performance.now() - t0) / 3200);
    reels.forEach(function (r) {
      if (!r.target) r.speed = 1.5 + 22.5 * k * k;
    });
  }, 80);
  await waitRaw(4200 + Math.random() * 1800);
  clearInterval(ramp);
  stopAmb();
  quiet = false;
  document.body.classList.remove("freezing");
  SE.freeze();
  flash();
  fxColor(6);
  await new Promise(function (ok) {
    stopReel(0, "7", 500, ok);
  });
  await new Promise(function (ok) {
    stopReel(2, "7", 500, ok);
  });
  await waitRaw(500);
  await new Promise(function (ok) {
    stopReel(1, "7", 1100, ok);
  });
  await waitRaw(300);
  return true;
}
// リーチ演出: 文字・赤い縁と画面の周りの点滅・心臓の音・真ん中のリールがゆっくり回る。色や当たり外れで、演出の種類や長さは変えない(結果が分からないように)
/** リーチ演出: 「REACH!!」の文字・赤い縁と画面の周りの点滅・心臓の音・真ん中のリールがゆっくり回る。色や当たり外れで、演出の種類や長さは変えない(結果が分からないように)。 */
async function reachScene() {
  var t = $("reachTxt");
  t.textContent = "REACH!!";
  t.classList.remove("strong");
  t.classList.add("on");
  document.body.classList.add("reach");
  lampLoop(true);
  SE.reach();
  reels[1].speed = 6; // 最後のリールが、ゆっくり回る
  var hb = setInterval(SE.beat, 520);
  await wait(1250);
  clearInterval(hb);
  t.classList.remove("on");
  document.body.classList.remove("reach");
}
/**
 * 当たりの演出(リールの光・ランプの点滅・画面の光と揺れ・コインの紙吹雪)。
 * @param big 紙吹雪の個数(0 なら出さない)
 */
function celebrate(big) {
  reelEls.forEach(function (e) {
    e.classList.add("hit");
  });
  lampsSet(true);
  lampLoop(true);
  flash();
  shake();
  if (big) burst(big);
}
