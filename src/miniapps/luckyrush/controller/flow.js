/** 通常時・チャンス中の、1 回転(レバー)。抽選 → 演出 → 結果。通常時に当たったら CHANCE(10 回転)へ、CHANCE 中に当たったら RUSH 確定。CHANCE の 10 回転が当たらずに終わったら、通常時へ戻る。AUTO のときは、続けて回す。 */
async function play() {
  if (st.busy || st.mode === "rush" || $("over").classList.contains("on")) return;
  st.busy = true;
  $("spin").disabled = true;
  var p = st.mode === "chance" ? P_CHANCE : P_NORMAL,
    d = lottery(p);
  st.total++;
  st.since++;
  showSince();
  if (st.mode === "chance") st.chance--;
  updateStatus();
  var hit = await runSpin(d, false);
  fxColor(-1);
  if (hit) {
    var took = hitReset();
    celebrate(st.mode === "chance" ? 140 : 60);
    SE.hit();
    if (st.mode === "normal") {
      banner("CHANCE!!");
      msg("あたり!!  " + took + "回転で当たり", "hit");
      st.mode = "chance";
      st.chance = CHANCE_SPINS;
      updateStatus();
      await wait(1500);
      lampLoop(false);
    } else {
      // チャンス中に当たった → RUSH 確定
      msg("RUSH 確定!!  " + took + "回転", "hit");
      await wait(1400);
      await startRush();
      return;
    }
  } else {
    if (st.mode === "chance" && st.chance <= 0) {
      st.mode = "normal";
      updateStatus();
      msg("チャンス終了…", "miss");
      lampLoop(false);
      await wait(800);
    } else {
      msg(d.enter && d.color >= 2 ? "惜しい…ハズレ" : "ハズレ", "miss");
      lampLoop(false);
      await wait(350);
    }
  }
  st.busy = false;
  $("spin").disabled = false;
  updateStatus();
  if (st.auto && !$("over").classList.contains("on"))
    setTimeout(
      function () {
        if (st.auto && !st.busy) play();
      },
      st.turbo ? 200 : 650,
    );
}

/** RUSH を始める(連チャン 1、100 ゲーム、ゲーム数は 0 から)。突入の演出のあと、`rushLoop` へ進む。 */
async function startRush() {
  st.mode = "rush";
  st.remain = RUSH_SPINS;
  st.chain = 1;
  st.games = 0;
  st.rushes++;
  updateStatus();
  setChain(1, true);
  SE.enter();
  burst(160);
  banner(L("RUSH 突入!!", "RUSH START!!"));
  await waitRaw(1500);
  lampLoop(true);
  await rushLoop();
}
/** RUSH のゲームを、100 ゲームぶん自動で回す。1 回転ごとに抽選し、当たれば継続(連チャン +1、また 100 ゲームから)。橙・緑以上の色と、当たり(白・青でも)、フリーズ以外は、高速(約 0.2 秒)。100 ゲームのうちに当たらなければ、終了。 */
async function rushLoop() {
  while (true) {
    if (st.remain <= 0) {
      await finish();
      return;
    }
    st.remain--;
    st.total++;
    st.since++;
    st.games++;
    showSince();
    updateStatus();
    var d = lottery(P_RUSH);
    var slow = (d.enter && d.color >= 2) || d.hit || d.freeze; // 橙・緑 以上と、当たりのとき(白・青でも)は、普通の速さで回して見せる
    var hit = await runSpin(d, !slow);
    if (slow) fxColor(-1);
    if (hit) {
      var tookR = hitReset();
      st.chain++;
      st.remain = RUSH_SPINS;
      updateStatus();
      setChain(st.chain, true);
      celebrate(Math.min(110, 50 + st.chain * 3));
      SE.hit();
      SE.chain(st.chain);
      msg("継続!!  " + st.chain + "連  (" + tookR + "回転で当たり)", "hit");
      var ms = {
        5: L("5連!!", "5 CHAIN!!"),
        10: L("10連!!", "10 CHAIN!!"),
        20: L("20連!!!", "20 CHAIN!!!"),
        30: L("30連突破!!", "30 CHAIN!!"),
        50: L("50連 超絶!!", "50 CHAIN - AMAZING!!"),
        77: L("77連 LUCKY!!", "77 CHAIN LUCKY!!"),
        100: L("100連 伝説!!", "100 CHAIN - LEGEND!!"),
      };
      if (ms[st.chain]) {
        banner(ms[st.chain]);
        burst(220);
      } else banner(L("継続!!", "CONTINUE!!"));
      await waitRaw(1500);
      lampLoop(true);
    }
  }
}
