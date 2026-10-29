/** RUSH の終了。記録(ハイスコア・履歴 10 件・RUSH 突入回数・合計・通算回転)を保存して、結果(連チャン数・称号・RUSH 数と総ゲーム)を出す。 */
async function finish() {
  var score = st.chain;
  SE.end();
  msg("RUSH 終了…", "miss");
  lampsSet(false);
  lampLoop(false);
  fxColor(-1);
  var rec = score > st.hi;
  st.hist.unshift(score);
  st.hist = st.hist.slice(0, 10);
  st.sum += score;
  if (rec) {
    st.hi = score;
    store.set("hi", score);
  }
  store.set("hist", JSON.stringify(st.hist));
  store.set("rushes", st.rushes);
  store.set("sum", st.sum);
  store.set("spins", st.total);
  await waitRaw(900);
  $("oScore").innerHTML = score + "<small>" + L("連", " chain") + "</small>";
  $("oRank").textContent = rankOf(score);
  $("oGames").textContent = L(
    "RUSH数: " + score + "連  総ゲーム: " + st.games,
    "RUSH: " + score + " chain  Total games: " + st.games,
  );
  $("oNew").classList.toggle("on", rec && score > 0);
  $("oSub").textContent = L(
    "最高連チャン " + st.hi + " 連 / 通算 " + st.total + " 回転",
    "Best chain " + st.hi + " / Total " + st.total + " spins",
  );
  $("over").classList.add("on");
  if (rec) {
    SE.record();
    burst(260);
    flash();
  }
  st.auto = false;
  $("auto").classList.remove("on");
  st.mode = "normal";
  st.chain = 0;
  st.remain = 0;
  updateStatus(); // 「当たりまで」の回転数は、RUSH が終わってもそのまま(当たったときだけリセット)
  st.busy = false;
  $("spin").disabled = false;
  refresh();
}
/**
 * 連チャン数から、称号を決める。
 * @param n 連チャン数
 */
function rankOf(n) {
  return n >= 30
    ? L("👑 伝説の引き", "👑 Legendary luck")
    : n >= 20
      ? L("S 神引き", "S Godly pull")
      : n >= 12
        ? L("A 爆連", "A Explosive chain")
        : n >= 7
          ? L("B 好調", "B On a roll")
          : n >= 4
            ? L("C 平均以上", "C Above average")
            : n >= 2
              ? L("D まずまず", "D Not bad")
              : L("E 次こそ…", "E Better luck next time…");
}
/** ハイスコア・最高連チャン・RUSH 突入・平均連チャン・通算回転・履歴の表示を更新する。 */
function refresh() {
  $("hi").textContent = st.hi;
  $("sBest").textContent = st.hi;
  $("sRush").textContent = st.rushes;
  $("sSpin").textContent = st.total;
  $("sAvg").textContent = st.rushes ? Math.round((st.sum / st.rushes) * 10) / 10 : 0;
  var h = $("hist");
  h.innerHTML = "";
  if (st.hist.length) {
    var t = document.createElement("span");
    t.textContent = L("履歴", "History");
    h.appendChild(t);
    st.hist.forEach(function (s) {
      var i = document.createElement("i");
      i.textContent = s;
      if (s === st.hi && s > 0) i.className = "best";
      h.appendChild(i);
    });
  }
}
/** 0〜1 の割合を、`12.3%` の文字列にする(小数第 1 位まで)。 */
function pct(x) {
  return Math.round(x * 1000) / 10 + "%";
}
/** 「?」の画面(遊び方・確率)の中身を作る。流れ・各確率・色ごとの出やすさと期待度は、設定の値から計算して出す(説明と実際の確率が、ずれない)。 */
function buildInfo() {
  var rows = COLORS.map(function (c) {
    return (
      "<tr><td><span class='d' style='background:" +
      (c.k === "rainbow" ? "conic-gradient(#f43f5e,#f59e0b,#22c55e,#3b82f6,#a855f7,#f43f5e)" : c.c) +
      "'></span>" +
      L(c.n, c.e) +
      "</td><td>" +
      pct(c.w) +
      "</td><td>" +
      pct(c.h) +
      "</td></tr>"
    );
  }).join("");
  $("infoBody").innerHTML = JA
    ? "<b>流れ</b><br>① NORMAL: 回すたびに「抽選に入るか」が決まり、入ると色の演出(1回転あたり 約1/" +
      Math.round(1 / P_NORMAL) +
      " で当たり)<br>② あたり → <b>CHANCE</b>。" +
      CHANCE_SPINS +
      "回転のうちに1回当たれば <b>RUSH確定</b><br>③ <b>RUSH</b>: " +
      RUSH_SPINS +
      "ゲームを高速で回し、その間に1回当たれば継続(また" +
      RUSH_SPINS +
      "ゲームから)。外れきると終了<br>RUSH中は1ゲームあたり約1/" +
      Math.round(1 / P_RUSH) +
      " → " +
      RUSH_SPINS +
      "回転で当たる確率(継続率) 約" +
      pct(1 - Math.pow(1 - P_RUSH, RUSH_SPINS)) +
      "<br>④ <b>RUSH の連チャン数</b>がスコア<br>「回転数」は、前回当たってからの回転数です(当たるとリセット)。「ゲーム数」は、RUSH で行った総ゲーム数です(RUSH が終わると、結果にも出ます)<br><table><tr><th>色</th><th>出やすさ</th><th>当たる期待度</th></tr>" +
      rows +
      "</table>SPACE: 回す / Esc: 閉じる"
    : "<b>How it works</b><br>① NORMAL: every spin decides whether you enter a draw; if you do, a color effect shows how likely a win is (about 1/" +
      Math.round(1 / P_NORMAL) +
      " per spin to win)<br>② A win → <b>CHANCE</b>. Win once within " +
      CHANCE_SPINS +
      " spins to lock in <b>RUSH</b><br>③ <b>RUSH</b>: " +
      RUSH_SPINS +
      " games are spun fast; win once in that time to continue (another " +
      RUSH_SPINS +
      " games). If you miss them all, it ends<br>In RUSH, each game wins about 1/" +
      Math.round(1 / P_RUSH) +
      " → the chance to win within " +
      RUSH_SPINS +
      " spins (continuation rate): about " +
      pct(1 - Math.pow(1 - P_RUSH, RUSH_SPINS)) +
      '<br>④ Your <b>RUSH chain count</b> is your score<br>"Spins" is the number of spins since your last win (it resets when you win). "Games" is the total number of games played in RUSH (also shown in the result when RUSH ends)<br><table><tr><th>Color</th><th>How often</th><th>Win chance</th></tr>' +
      rows +
      "</table>SPACE: spin / Esc: close";
}
