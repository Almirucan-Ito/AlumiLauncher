// ---- 音(その場で作る単純な音。音源ファイルは使わない) ----
var ac = null,
  master = null;
/**
 * 音を出すための AudioContext(と、音量の `master`)を用意する。音がオフ、または音量 0 のときは、作らず `null`。
 * @returns AudioContext。使えなければ `null`
 */
function ctx() {
  if (!st.sound || st.vol <= 0) return null;
  try {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain();
      master.gain.value = st.vol;
      master.connect(ac.destination);
    }
    if (ac.state === "suspended") ac.resume();
    return ac;
  } catch (e) {
    return null;
  }
}
/**
 * 効果音の音量を決める(スライダーの表示も合わせる)。
 * @param v 0〜1
 */
function setVol(v) {
  st.vol = Math.max(0, Math.min(1, v));
  if (master) master.gain.value = st.vol;
  $("vol").style.setProperty("--p", Math.round(st.vol * 100) + "%");
}
/**
 * 単純な音を 1 つ鳴らす(音源ファイルは使わず、その場で作る)。立ち上がりと減衰を付けて、プツッという雑音を避ける。
 * @param f 周波数(Hz)
 * @param t0 鳴らし始めるまでの時間(秒)
 * @param dur 長さ(秒)
 * @param type 波形(`sine` / `square` / `triangle` / `sawtooth`)
 * @param vol 音量
 * @param slide 音程を、この周波数まで変えていく(省略可)
 */
function tone(f, t0, dur, type, vol, slide) {
  var c = ctx();
  if (!c) return;
  var o = c.createOscillator(),
    g = c.createGain(),
    t = c.currentTime + (t0 || 0);
  o.type = type || "sine";
  o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol || 0.12, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}
var SE0 = {
  tick: function () {
    tone(520 + Math.random() * 60, 0, 0.05, "square", 0.025);
  },
  fast: function () {
    tone(700 + Math.random() * 200, 0, 0.03, "square", 0.012);
  },
  stop: function () {
    tone(150, 0, 0.12, "sine", 0.2, 60);
    tone(900, 0, 0.05, "square", 0.05);
  },
  lever: function () {
    tone(300, 0, 0.1, "sawtooth", 0.07, 120);
  },
  color: function (i) {
    var f = 330 * Math.pow(1.22, i);
    tone(f, 0, 0.18, "triangle", 0.12);
    if (i >= 4) tone(f * 1.5, 0.08, 0.25, "triangle", 0.1);
    if (i >= 6)
      [0, 1, 2, 3].forEach(function (k) {
        tone(f * Math.pow(1.26, k), 0.1 + k * 0.07, 0.2, "sine", 0.1);
      });
  },
  beat: function () {
    tone(80, 0, 0.14, "sine", 0.28, 45);
    tone(80, 0.17, 0.12, "sine", 0.2, 45);
  },
  reach: function () {
    [0, 0.12, 0.24, 0.36].forEach(function (d, i) {
      tone(440 * Math.pow(1.19, i), d, 0.14, "sawtooth", 0.07);
    });
  },
  freeze: function () {
    var c = ctx();
    if (!c) return;
    tone(180, 0, 0.7, "sawtooth", 0.1, 1800);
    tone(90, 0.55, 0.9, "sine", 0.3, 40);
    [523, 659, 784, 1047, 1319, 1568, 2093].forEach(function (f, i) {
      tone(f, 0.6 + i * 0.05, 1.4, "square", 0.07);
      tone(f, 0.6 + i * 0.05, 1.4, "triangle", 0.12);
    });
    [0, 1, 2, 3, 4, 5].forEach(function (k) {
      tone(1568 + k * 180, 1.1 + k * 0.1, 0.3, "sine", 0.1);
    });
  },
  hit: function () {
    [523, 659, 784, 1047, 1319].forEach(function (f, i) {
      tone(f, i * 0.08, 0.3, "triangle", 0.14);
    });
    tone(130, 0, 0.4, "sine", 0.2, 60);
  },
  chain: function (n) {
    var base = 392 * Math.pow(2, (Math.min(n, 24) / 24) * 1.2);
    tone(base, 0, 0.2, "triangle", 0.14);
    tone(base * 1.5, 0.09, 0.28, "triangle", 0.1);
  },
  enter: function () {
    [392, 494, 587, 784, 988, 1175, 1568].forEach(function (f, i) {
      tone(f, i * 0.07, 0.35, "square", 0.07);
      tone(f / 2, i * 0.07, 0.35, "triangle", 0.1);
    });
  },
  end: function () {
    [392, 330, 262, 196].forEach(function (f, i) {
      tone(f, i * 0.16, 0.35, "triangle", 0.13);
    });
  },
  record: function () {
    [784, 988, 1175, 1568, 1976].forEach(function (f, i) {
      tone(f, i * 0.1, 0.5, "triangle", 0.14);
    });
  },
};
var SE = {};
Object.keys(SE0).forEach(function (k) {
  SE[k] = function () {
    try {
      SE0[k].apply(null, arguments);
    } catch (e) {}
  };
});
