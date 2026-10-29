// ---- ストップウォッチ ----
/**
 * ストップウォッチの、いまの経過時間(ミリ秒)。
 * @returns 動いていれば、前回までの経過 + 動き始めてからの時間
 */
function swNow() {
  return sw.running ? sw.elapsed + (Date.now() - sw.start) : sw.elapsed;
}
/** 数を 2 桁(先頭 0 埋め)の文字列にする。 */
function p2(n) {
  return ("0" + n).slice(-2);
}
/**
 * ストップウォッチの時間を、`[時:]分:秒.ミリ秒`(ミリ秒は 3 桁)の文字列にする。
 * @param ms ミリ秒
 */
function fmtSw(ms) {
  ms = Math.floor(ms);
  var h = Math.floor(ms / 3600000),
    m = Math.floor(ms / 60000) % 60,
    s = Math.floor(ms / 1000) % 60;
  return (h ? h + ":" : "") + p2(m) + ":" + p2(s) + "." + ("00" + (ms % 1000)).slice(-3);
}
// 桁ごとに幅を固定した表示。数字の幅が揺れないので、ミリ秒が動いてもガタつかない
var swCells = [],
  swLen = 0,
  swRaf = 0;
/** ストップウォッチの数字を描く。桁ごとに幅を固定した部品に分けて、変わった桁だけを書き換える(ミリ秒が動いても、数字の幅が揺れてガタつかない)。 */
function swDraw() {
  var s = fmtSw(swNow()),
    box = $("swt");
  if (s.length !== swLen) {
    box.innerHTML = "";
    swCells = [];
    swLen = s.length;
    for (var i = 0; i < s.length; i++) {
      var c = document.createElement("span"),
        ch = s[i],
        ms = i > s.length - 4;
      c.className =
        (ch === ":" || ch === "." ? "s" : "") + (ms && ch !== "." ? " ms" : "") + (ch === "." ? " dot" : "");
      if (ch === ":") c.className = "s";
      box.appendChild(c);
      swCells.push(c);
    }
  }
  for (var j = 0; j < s.length; j++) if (swCells[j].textContent !== s[j]) swCells[j].textContent = s[j];
}
/** ストップウォッチの描き直しを、画面の更新(`requestAnimationFrame`)に合わせて、動いている間だけ繰り返す。 */
function swLoop() {
  swRaf = 0;
  if (cur !== "sw") return;
  swDraw();
  if (sw.running) swRaf = requestAnimationFrame(swLoop);
}
/** ストップウォッチが動いていて、その画面を見ているときだけ、描き直しの繰り返しを始める(二重に始めない)。 */
function swKick() {
  if (!swRaf && sw.running && cur === "sw") swRaf = requestAnimationFrame(swLoop);
}
/** ストップウォッチの状態(経過・ラップ)を保存する。 */
function swSave() {
  store.set("sw", JSON.stringify(sw));
}
/** ストップウォッチの画面(数字・ボタンの文言・ラップの一覧)を描き直す。 */
function renderSw() {
  swDraw();
  swKick();
  $("swgo").textContent = sw.running ? L("停止", "Stop") : L("開始", "Start");
  $("swlap").disabled = !sw.running;
  var l = $("laps");
  l.innerHTML = "";
  sw.laps
    .slice()
    .reverse()
    .forEach(function (t, i) {
      var n = sw.laps.length - i,
        prev = n > 1 ? sw.laps[n - 2] : 0;
      var r = document.createElement("div");
      r.className = "lap";
      r.innerHTML =
        "<span>" +
        L("ラップ ", "Lap ") +
        n +
        "</span><span>+" +
        fmtSw(t - prev) +
        "</span><span class=dim>" +
        fmtSw(t) +
        "</span>";
      l.appendChild(r);
    });
}
