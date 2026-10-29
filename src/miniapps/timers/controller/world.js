// ---- 世界時計 ----
/** 世界時計を描き直す(都市ごとの時刻・日付・いまの場所との時差・削除ボタン)。 */
function renderWorld() {
  var now = new Date(),
    loc = -now.getTimezoneOffset(),
    l = $("zl");
  l.innerHTML = "";
  zones.forEach(function (z, i) {
    var d = new Intl.DateTimeFormat(undefined, {
      timeZone: z,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).format(now);
    var dt = new Intl.DateTimeFormat(undefined, {
      timeZone: z,
      month: "short",
      day: "numeric",
      weekday: "short",
    }).format(now);
    var diff = offMin(z, now) - loc;
    var c = document.createElement("div");
    c.className = "card zone";
    c.innerHTML =
      '<div class="lb"><div class="city">' +
      esc(tzLabel(z)) +
      '</div><div class="sub">' +
      esc(dt) +
      " ・ " +
      L("いまの場所との差 ", "vs. local ") +
      fmtHM(diff) +
      '</div></div><div class="tm">' +
      esc(d) +
      '</div><button class="x">×</button>';
    c.querySelector(".x").onclick = function () {
      zones.splice(i, 1);
      store.set("zones", JSON.stringify(zones));
      renderWorld();
    };
    l.appendChild(c);
  });
}
