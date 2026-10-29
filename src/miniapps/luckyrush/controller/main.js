// ---- 起動 ----
/** 画面の固定の文言(index.html に日本語で書いてある分)を、日本語以外の表示言語のとき、英語にする。 */
function localizeStatic() {
  if (JA) return;
  document.documentElement.lang = "en";
  document.title = "Lucky Rush";
  function set(sel, text) {
    var e = document.querySelector(sel);
    if (e) e.textContent = text;
  }
  function attr(sel, name, text) {
    var e = document.querySelector(sel);
    if (e) e.setAttribute(name, text);
  }
  set(".logo small", "RUSH 100 spins · about 90% continuation");
  attr("#vol", "title", "Volume");
  attr(".meters .mt:nth-child(1)", "title", "Spins since your last win (resets when you win)");
  set(".meters .mt:nth-child(1) span", "Spins");
  attr(".meters .mt:nth-child(2)", "title", "Total games played in RUSH");
  set(".meters .mt:nth-child(2) span", "Games");
  set(".counter .lb", "Chain");
  set(".counter .u", "");
  set(".foot .stat:nth-child(1) span", "Best chain");
  set(".foot .stat:nth-child(2) span", "RUSH entries");
  set(".foot .stat:nth-child(3) span", "Avg. chain");
  set(".foot .stat:nth-child(4) span", "Total spins");
  set("#over h2", "RUSH over");
  set("#oBtn", "Again");
  set("#infoP h2", "How to play & odds");
  set("#infoClose", "Close");
}
localizeStatic();
[0, 1, 2].forEach(function (i) {
  setReel(i, "7");
});
addEventListener("resize", function () {
  reels.forEach(drawReel);
});
setVol(st.vol);
updateStatus();
msg("STARTでレバーON!  RUSHの連チャン数がスコア");
Promise.all([
  store.get("hi"),
  store.get("hist"),
  store.get("rushes"),
  store.get("sum"),
  store.get("sound"),
  store.get("turbo"),
  store.get("spins"),
  store.get("vol"),
]).then(function (r) {
  st.hi = Math.max(0, parseInt(r[0], 10) || 0);
  try {
    var h = JSON.parse(r[1] || "[]");
    if (Array.isArray(h)) st.hist = h.filter(Number.isFinite).slice(0, 10);
  } catch (e) {}
  st.rushes = Math.max(0, parseInt(r[2], 10) || 0);
  st.sum = Math.max(0, parseInt(r[3], 10) || 0);
  st.total = Math.max(0, parseInt(r[6], 10) || 0);
  if (r[4] === "0") {
    st.sound = false;
    $("snd").textContent = "🔇";
  }
  if (r[5] === "1") {
    st.turbo = true;
    $("turbo").classList.add("on");
  }
  if (r[7] != null && r[7] !== "" && isFinite(parseInt(r[7], 10))) {
    setVol(parseInt(r[7], 10) / 100);
    $("vol").value = Math.round(st.vol * 100);
  }
  refresh();
});
refresh();
