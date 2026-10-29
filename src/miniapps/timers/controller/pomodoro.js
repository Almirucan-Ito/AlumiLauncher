// ---- ポモドーロ ----
/**
 * ポモドーロの、各段階の長さ(分)。
 * @param ph `"focus"`(集中)/ `"short"`(休憩)/ それ以外(長い休憩)
 */
function pLen(ph) {
  return ph === "focus" ? cfg.f : ph === "short" ? cfg.s : cfg.l;
}
/** ポモドーロの、各段階の表示名。 */
function pName(ph) {
  return ph === "focus" ? L("集中", "Focus") : ph === "short" ? L("休憩", "Break") : L("長い休憩", "Long break");
}
/** ポモドーロの状態と設定(各段階の長さ・回数)を保存する。 */
function pSave() {
  store.set("pomo", JSON.stringify(pomo));
  store.set("cfg", JSON.stringify(cfg));
}
/** 集中時間の記録を保存する(直近 60 日ぶんだけ残す)。 */
function logSave() {
  var ks = Object.keys(log).sort();
  while (ks.length > 60) {
    delete log[ks.shift()];
  }
  store.set("log", JSON.stringify(log));
}
/**
 * ポモドーロの段階を始める。終わりの時刻に、ランチャーのアラームを仕掛ける(ミニアプリを閉じていても、音と画面で知らせる)。
 * @param ph 段階(`focus` / `short` / `long`)
 */
function pStart(ph) {
  pomo.phase = ph;
  pomo.endAt = Date.now() + pLen(ph) * 60000;
  call("alarm.set", {
    id: "pomo",
    at: pomo.endAt,
    label: pName(ph) + L(" が終わりました", " finished"),
    kind: ph === "focus" ? "focus" : "break",
    minutes: pLen(ph),
  }).catch(function () {});
  pSave();
  renderPomo();
}
/** ポモドーロを中止する(アラームも取り消す)。 */
function pStop() {
  pomo.phase = "idle";
  pomo.endAt = 0;
  pomo.next = "focus";
  call("alarm.cancel", { id: "pomo" }).catch(function () {});
  pSave();
  renderPomo();
}
/**
 * ポモドーロの段階が終わったときの処理。集中が終わったら、その日の集中時間に足して、次の休憩(回数が来たら長い休憩)を決める。
 * @param kind `focus` / `break` / `skip`
 * @param minutes その段階の分数
 * @param at 終わった時刻(UNIX ミリ秒)
 */
function pFinished(kind, minutes, at) {
  if (kind === "focus") {
    var k = ymd(new Date(at));
    log[k] = (log[k] || 0) + minutes;
    logSave();
    pomo.cycle++;
    pomo.next = (pomo.cycle - 1) % cfg.c === 0 ? "long" : "short";
  } else {
    pomo.next = "focus";
    if (pomo.phase === "long") pomo.cycle = 1;
  }
  pomo.phase = "idle";
  pomo.endAt = 0;
  pSave();
  renderPomo();
}
/** ポモドーロの画面を描き直す(段階・残り時間・今日の集中時間・直近 7 日のグラフ)。 */
function renderPomo() {
  var run = pomo.phase !== "idle" && pomo.endAt > 0;
  var left = run ? Math.max(0, Math.ceil((pomo.endAt - Date.now()) / 1000)) : pLen(pomo.next) * 60;
  $("ptime").textContent = fmtT(left);
  $("pphase").textContent = run
    ? pName(pomo.phase) + " (" + pomo.cycle + "/" + cfg.c + ")"
    : L("次: ", "Next: ") + pName(pomo.next);
  $("pgo").textContent = run ? L("スキップ", "Skip") : L("開始", "Start") + " (" + pName(pomo.next) + ")";
  $("pstop").disabled = !run;
  var tk = ymd(new Date());
  $("today").textContent = (log[tk] || 0) + L(" 分", " min");
  var w = $("week");
  w.innerHTML = "";
  var mx = 30;
  for (var i = 6; i >= 0; i--) {
    var d = new Date();
    d.setDate(d.getDate() - i);
    mx = Math.max(mx, log[ymd(d)] || 0);
  }
  for (var j = 6; j >= 0; j--) {
    var dd = new Date();
    dd.setDate(dd.getDate() - j);
    var k = ymd(dd),
      m = log[k] || 0;
    var b = document.createElement("div");
    b.className = "bar" + (j === 0 ? " today" : "");
    b.innerHTML =
      "<span>" +
      m +
      "</span><i style='height:" +
      Math.round((m / mx) * 80) +
      "px'></i><span>" +
      (JA
        ? ["日", "月", "火", "水", "木", "金", "土"][dd.getDay()]
        : ["S", "M", "T", "W", "T", "F", "S"][dd.getDay()]) +
      "</span>";
    w.appendChild(b);
  }
}
/** いま見ているタブの画面を描き直す。 */
function renderAll() {
  if (cur === "world") renderWorld();
  else if (cur === "sw") renderSw();
  else if (cur === "timer") renderTimers();
  else renderPomo();
}
