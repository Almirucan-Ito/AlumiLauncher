/** 今年の経過(日数)を、割合として、画面に出す。 */
function draw() {
  var now = new Date(),
    y = now.getFullYear();
  var p =
    ((now.getTime() - new Date(y, 0, 1).getTime()) / (new Date(y + 1, 0, 1).getTime() - new Date(y, 0, 1).getTime())) *
    100;
  document.getElementById("year").textContent = y;
  document.getElementById("pct").textContent = p.toFixed(1) + "%";
  document.getElementById("fill").style.width = p + "%";
}
draw();
setInterval(draw, 60000);
// ランチャーから文字色が届いたら合わせる(任意)
window.addEventListener("message", function (e) {
  if (e.data && e.data.type === "alumi:theme") document.body.style.color = e.data.text;
});
