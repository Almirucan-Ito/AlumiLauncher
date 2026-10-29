/*
 * ウィジェットのひな形。同梱のウィジェットと同じ、次の並びで書く:
 *   1. 小さな道具   2. 描画   3. 更新(タイマー)   4. ランチャーからの知らせ(色)
 * ・ウィジェットは、ランチャーの機能(保存・ファイルなど)を使えない。表示だけを行う
 * ・外部のサーバーと通信したいときは、widget.json に "network": true と書く(初めて使うとき、利用者の同意が要る)
 */

// ==== 1. 小さな道具 ====
var JA = (navigator.language || "ja").toLowerCase().indexOf("ja") === 0;
/**
 * 表示言語(日本語か、それ以外か)に合わせて、文言を選ぶ。
 * @param ja 日本語のとき
 * @param en それ以外のとき
 */
function L(ja, en) {
  return JA ? ja : en;
}
/** ID から要素を取る。 */
function $(id) {
  return document.getElementById(id);
}

// ==== 2. 描画 ====
/** いまの時刻(時:分:秒)を、画面に出す。 */
function draw() {
  var d = new Date(),
    p = function (n) {
      return ("0" + n).slice(-2);
    };
  $("title").textContent = L("いまの時刻", "Current time");
  $("value").textContent = p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
}

// ==== 3. 更新(1 秒ごと) ====
draw();
setInterval(draw, 1000);

// ==== 4. ランチャーからの知らせ ====
/** ランチャーの文字色が届いたら、合わせる(受け取らなくてもよい)。 */
addEventListener("message", function (e) {
  if (e.data && e.data.type === "alumi:theme") document.body.style.color = e.data.text;
});
