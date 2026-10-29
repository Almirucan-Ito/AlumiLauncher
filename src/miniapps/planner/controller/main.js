/** ToDo・カレンダー・選んだ日の一覧を、すべて描き直す。 */
function renderAll() {
  renderTodo();
  renderCal();
  renderDay();
}
/**
 * タブ(ToDo / カレンダー)を切り替える。
 * @param t `"todo"` か `"cal"`
 */
function setTab(t) {
  document.querySelectorAll(".tab").forEach(function (b) {
    b.classList.toggle("on", b.dataset.t === t);
  });
  $("v-todo").style.display = t === "todo" ? "" : "none";
  $("v-cal").style.display = t === "cal" ? "" : "none";
}
document.querySelectorAll(".tab").forEach(function (b) {
  b.onclick = function () {
    setTab(b.dataset.t);
  };
});
$("tabTodo").textContent = "ToDo";
$("tabCal").textContent = L("カレンダー", "Calendar");
$("tt").placeholder = L("やることを入力", "New task");
$("tc").placeholder = L("カテゴリ", "Category");
$("tadd").textContent = L("追加", "Add");
$("fdoneL").textContent = L("完了済みも表示", "Show completed");
$("fsort").innerHTML =
  '<option value="due">' +
  L("期限順", "By due date") +
  '</option><option value="added">' +
  L("追加順", "By added") +
  '</option><option value="cat">' +
  L("カテゴリ順", "By category") +
  '</option><option value="name">' +
  L("名前順", "By name") +
  "</option>";
$("ctoday").textContent = L("今日", "Today");
$("et").placeholder = L("予定の名前", "Event title");
$("em").placeholder = L("メモ(省略可)", "Note (optional)");
$("eadd").textContent = L("追加", "Add");
/** 入力欄の内容で、ToDo を追加する(期限・カテゴリつき。空なら何もしない)。 */
function addTask() {
  var t = $("tt").value.trim();
  if (!t) return;
  tasks.push({ id: uid(), t: t, done: false, due: $("td").value || "", cat: $("tc").value.trim(), ts: Date.now() });
  $("tt").value = "";
  saveTasks();
  renderAll();
  $("tt").focus();
}
$("tadd").onclick = addTask;
$("tt").onkeydown = function (e) {
  e.stopPropagation();
  if (e.key === "Enter" && !e.isComposing) addTask();
};
$("fcat").onchange = function () {
  catFilter = this.value;
  renderTodo();
};
$("fsort").onchange = function () {
  sortKey = this.value;
  renderTodo();
};
$("fdone").onchange = function () {
  showDone = this.checked;
  renderTodo();
};
$("cprev").onclick = function () {
  view.m--;
  if (view.m < 0) {
    view.m = 11;
    view.y--;
  }
  renderCal();
};
$("cnext").onclick = function () {
  view.m++;
  if (view.m > 11) {
    view.m = 0;
    view.y++;
  }
  renderCal();
};
$("ctoday").onclick = function () {
  var n = new Date();
  view = { y: n.getFullYear(), m: n.getMonth() };
  selDate = ymd(n);
  renderCal();
  renderDay();
};
/** 入力欄の内容で、選んだ日の予定を追加する。 */
function addEvent() {
  var t = $("et").value.trim();
  if (!t) return;
  events.push({ id: uid(), date: selDate, t: t, note: $("em").value.trim() });
  $("et").value = "";
  $("em").value = "";
  saveEvents();
  renderAll();
}
$("eadd").onclick = addEvent;
$("et").onkeydown = function (e) {
  e.stopPropagation();
  if (e.key === "Enter" && !e.isComposing) addEvent();
};
$("em").onkeydown = $("et").onkeydown;
addEventListener("keydown", function (e) {
  if (e.key === "Escape" && !(e.target && e.target.tagName === "INPUT")) call("close");
});
var n0 = new Date();
view = { y: n0.getFullYear(), m: n0.getMonth() };
Promise.all([store.get("tasks"), store.get("events")]).then(function (r) {
  tasks = parseJson(r[0], []);
  events = parseJson(r[1], []);
  if (!Array.isArray(tasks)) tasks = [];
  if (!Array.isArray(events)) events = [];
  renderAll();
});
