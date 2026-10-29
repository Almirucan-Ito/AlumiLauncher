/** 表示中の月の 1 日を返す。 */
function monthStart() {
  return new Date(view.y, view.m, 1);
}
/** カレンダー(6 週間ぶん)を描き直す。日付ごとに、予定と期限つきの ToDo の印を出し、押すとその日を選ぶ。 */
function renderCal() {
  $("ctitle").textContent = JA
    ? view.y + "年" + (view.m + 1) + "月"
    : new Date(view.y, view.m, 1).toLocaleDateString(undefined, { year: "numeric", month: "long" });
  var g = $("cgrid");
  g.innerHTML = "";
  var names = JA ? ["日", "月", "火", "水", "木", "金", "土"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  names.forEach(function (n, i) {
    var w = document.createElement("div");
    w.className = "wd" + (i === 0 ? " sun" : i === 6 ? " sat" : "");
    w.textContent = n;
    g.appendChild(w);
  });
  var first = monthStart(),
    start = new Date(first);
  start.setDate(1 - first.getDay());
  var today = ymd(new Date());
  for (var i = 0; i < 42; i++) {
    var d = new Date(start);
    d.setDate(start.getDate() + i);
    var key = ymd(d);
    var ec = events.filter(function (e) {
        return e.date === key;
      }).length,
      tc = tasks.filter(function (t) {
        return !t.done && t.due === key;
      }).length;
    var c = document.createElement("div");
    c.className =
      "day" +
      (d.getMonth() !== view.m ? " other" : "") +
      (key === today ? " today" : "") +
      (key === selDate ? " sel" : "");
    c.innerHTML =
      '<span class="' +
      (d.getDay() === 0 ? "sun" : d.getDay() === 6 ? "sat" : "") +
      '">' +
      d.getDate() +
      '</span><span class="dots">' +
      (ec ? '<i class="dot e"></i>' : "") +
      (ec > 1 ? '<i class="dot e"></i>' : "") +
      (tc ? '<i class="dot t"></i>' : "") +
      "</span>";
    c.onclick = (function (k) {
      return function () {
        selDate = k;
        renderCal();
        renderDay();
      };
    })(key);
    g.appendChild(c);
  }
}
/** 選んだ日の、予定と期限つきの ToDo の一覧を描き直す。 */
function renderDay() {
  $("dayTitle").textContent = selDate + " " + L("の予定", "") + "";
  var l = $("dayList");
  l.innerHTML = "";
  events
    .filter(function (e) {
      return e.date === selDate;
    })
    .forEach(function (e) {
      var el = document.createElement("div");
      el.className = "item";
      el.innerHTML =
        '<span class="chip" style="background:#2f6bff;color:#fff">' +
        L("予定", "Event") +
        '</span><span class="tx"><b>' +
        esc(e.t) +
        "</b>" +
        (e.note ? '<br><span class="dim">' + esc(e.note) + "</span>" : "") +
        '</span><button class="x">×</button>';
      el.querySelector(".x").onclick = function () {
        events = events.filter(function (x) {
          return x !== e;
        });
        saveEvents();
        renderAll();
      };
      l.appendChild(el);
    });
  tasks
    .filter(function (t) {
      return t.due === selDate;
    })
    .forEach(function (t) {
      l.appendChild(itemEl(t));
    });
  if (!l.children.length) {
    var e = document.createElement("div");
    e.className = "dim";
    e.textContent = L("この日の予定・ToDo はありません", "Nothing on this day");
    l.appendChild(e);
  }
}
