// ---- 演出 ----
/** 図柄を 1 つ、無作為に選ぶ。 */
function pick() {
  return SYMS[Math.floor(Math.random() * SYMS.length)];
}
/**
 * `x` 以外の図柄を、無作為に選ぶ。
 * @param x 除く図柄
 */
function pickOther(x) {
  var i = SYMS.indexOf(x);
  return SYMS[(i + 1 + Math.floor(Math.random() * (SYMS.length - 1))) % SYMS.length];
}
/** (使っていない)以前は、スロットの下に文言を出していた。演出は、色・バナー・数字で見せるので、何もしない(呼び出しだけ残してある)。 */
function msg(_text, _cls) {} // スロット下の文言は出さない(演出は、色・バナー・数字で見せる)
/**
 * 画面の中央に、大きな文字(「CHANCE!!」「RUSH 突入!!」など)を、拡大しながら出して消す。
 * @param t 文言
 */
function banner(t) {
  var b = $("banner");
  b.textContent = t;
  b.classList.remove("go");
  void b.offsetWidth;
  b.classList.add("go");
}
/** 画面全体を、白く光らせる。 */
function flash() {
  var f = $("flash");
  f.classList.remove("go");
  void f.offsetWidth;
  f.classList.add("go");
}
/** スロットの枠を、揺らす。 */
function shake() {
  var s = $("stage");
  s.classList.remove("shake");
  void s.offsetWidth;
  s.classList.add("shake");
}
/** 「回転数」(前回当たってから)と「ゲーム数」(RUSH で行った総ゲーム数)の表示を更新する。 */
function showSince() {
  $("since").textContent = st.since;
  $("games").textContent = st.games;
}
/**
 * 連チャン数の表示を更新する。
 * @param n 連チャン数
 * @param bump `true` なら、数字を大きく弾ませる
 */
function setChain(n, bump) {
  var c = $("chain");
  c.textContent = n;
  if (bump) {
    c.classList.remove("bump");
    void c.offsetWidth;
    c.classList.add("bump");
  }
}
/**
 * 上のランプを光らせる。
 * @param on `true` で全部、`false` で全部消す、数値なら、その偶奇のランプだけ(交互に光らせる)
 */
function lampsSet(on) {
  [].forEach.call($("lamps").children, function (l, i) {
    l.classList.toggle("on", on === true ? true : on === false ? false : i % 2 === on % 2);
  });
}
/**
 * ランプを、交互に点滅させ続ける。
 * @param fast `true` なら速く(当たり・リーチ)、`false` なら、ゆっくり
 */
var lampTimer = 0;
function lampLoop(fast) {
  clearInterval(lampTimer);
  var n = 0;
  lampTimer = setInterval(
    function () {
      lampsSet(n++ % 2);
    },
    fast ? 140 : 420,
  );
}
for (var li = 0; li < 14; li++) {
  var lp = document.createElement("i");
  lp.className = "lamp";
  $("lamps").appendChild(lp);
}
lampLoop(false);
COLORS.forEach(function (c) {
  var d = document.createElement("i");
  d.className = "chip";
  d.style.background = c.k === "rainbow" ? "conic-gradient(#f43f5e,#f59e0b,#22c55e,#3b82f6,#a855f7,#f43f5e)" : c.c;
  d.style.color = c.c;
  d.title = c.n;
  $("chips").appendChild(d);
});
// 色の演出。i = COLORS の番号、-1 で消す
/**
 * 色の演出を出す(枠・背景・ランプ・色の玉が、その色に光る。虹は枠が七色に流れ、金は明るさが脈打つ)。
 * @param i 色の番号(白 0 〜 虹 6)。-1 で消す
 */
function fxColor(i) {
  var s = $("stage"),
    t = $("tint");
  s.classList.toggle("fx", i >= 0);
  s.classList.toggle("rainbow", i === 6);
  s.classList.toggle("gold", i === 5);
  if (i >= 0) document.documentElement.style.setProperty("--fx", COLORS[i].c);
  t.classList.toggle("on", i >= 0);
  [].forEach.call($("chips").children, function (c, k) {
    c.classList.toggle("on", k === i);
  });
  if (i >= 0) SE.color(i);
}
/** いまの状態(NORMAL / CHANCE / RUSH)・残りの回転(ゲーム)数・バーの長さ・ボタンの文言・背景を、画面に反映する。 */
function updateStatus() {
  var m = st.mode,
    stl = $("stl"),
    str = $("str"),
    bar = $("barfill");
  document.body.classList.toggle("chance", m === "chance");
  document.body.classList.toggle("rush", m === "rush");
  if (m === "normal") {
    stl.textContent = "NORMAL";
    str.textContent = "";
    bar.style.width = "0";
  } else if (m === "chance") {
    stl.textContent = "CHANCE";
    str.textContent = L("あと " + st.chance + " 回転", st.chance + " spins left");
    bar.style.width = (st.chance / CHANCE_SPINS) * 100 + "%";
  } else {
    stl.textContent = "⚡ RUSH ⚡";
    str.textContent = L("残り " + st.remain + " ゲーム", st.remain + " games left");
    bar.style.width = (st.remain / RUSH_SPINS) * 100 + "%";
  }
  showSince();
  $("spinT").textContent = m === "rush" ? "RUSH" : m === "chance" ? "CHANCE" : "START";
}

// 1回転ぶんの演出。d = 抽選の結果 / fast = 高速(約0.2秒で確定)。戻り値: 当たったか
/**
 * 1 回転ぶんの演出をする。
 * 普通の速さ: レバー → 色が下から順に上がっていく(上がらなければ、そこで止まる)→ 左・右のリールが止まる → 左右が同じ目ならリーチ演出 → 真ん中のリールが止まる。
 * 高速(RUSH 中の白・青などの外れ): 約 0.2 秒で、数字だけ確定する。
 * @param d 抽選の結果(`lottery` の戻り値)
 * @param fast 高速で回すか
 * @returns 当たったか
 */
async function runSpin(d, fast) {
  var sym = pick(),
    L,
    R,
    C;
  if (d.hit) {
    L = R = C = sym;
  } else {
    var rm = d.enter && d.color >= 4 ? 0.7 : d.enter && d.color >= 2 ? 0.3 : 0.04;
    if (Math.random() < rm) {
      L = R = sym;
      C = pickOther(sym);
    } else {
      L = sym;
      R = pickOther(L);
      C = pick();
    }
  }
  reelEls.forEach(function (e) {
    e.classList.remove("hit");
  });
  if (fast) {
    // 色が橙・緑より下なら、色をちらっと光らせるだけ。数字は約0.2秒で確定
    if (d.enter) {
      $("stage").classList.add("fx");
      document.documentElement.style.setProperty("--fx", COLORS[d.color].c);
    }
    SE.fast();
    for (var k = 0; k < 2; k++) {
      reels.forEach(function (r, i) {
        setReel(i, pick());
      });
      await waitRaw(55);
    }
    setReel(0, L);
    setReel(1, C);
    setReel(2, R);
    await waitRaw(50);
    if (d.enter) $("stage").classList.remove("fx");
    return d.hit;
  }
  // 通常の回転
  msg("…");
  SE.lever();
  startReels();
  var tk = setInterval(SE.tick, 90);
  if (d.enter) {
    // 色は下から順に上がっていく(上がらなければ、そこで止まる)
    var from = Math.max(0, d.color - (1 + Math.floor(Math.random() * 3)));
    for (var c = from; c <= d.color; c++) {
      fxColor(c);
      msg(COLORS[c].n + (c >= 2 ? "  チャンス!" : ""), "fxm");
      await wait(c === d.color ? 750 : 520);
    }
  } else {
    await wait(st.mode === "rush" ? 500 : 850);
  }
  if (d.freeze) {
    clearInterval(tk);
    return await freezeRest();
  }
  await new Promise(function (ok) {
    stopReel(0, L, 420, ok);
  });
  await wait(200);
  await new Promise(function (ok) {
    stopReel(2, R, 420, ok);
  });
  var isReach = L === R;
  if (isReach) {
    clearInterval(tk);
    await reachScene();
  }
  clearInterval(tk);
  await new Promise(function (ok) {
    stopReel(1, C, isReach ? 1000 : 520, ok);
  });
  await wait(200);
  return d.hit;
}
// 当たったとき: 「当たりまで」の回転数をリセットして、かかった回転数を返す
/**
 * 当たったとき: 「回転数」(前回当たってから)をリセットして、かかった回転数を返す(「前回 N」として、表示に残す)。
 * @returns 当たるまでにかかった回転数
 */
function hitReset() {
  var n = st.since;
  st.since = 0;
  showSince();
  $("prevHit").textContent = n ? L("(前回 " + n + ")", "(last: " + n + ")") : "";
  return n;
}
