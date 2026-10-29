/**
 * ToDo 1 件の行を作る(完了のチェック・期限とカテゴリの表示・ダブルクリックで名前の編集・削除)。
 * @param t ToDo
 * @returns 行の要素
 */
function itemEl(t) {
  var el = document.createElement("div");
  el.className = "item" + (t.done ? " done" : "");
  var late = !t.done && t.due && t.due < ymd(new Date()),
    today = !t.done && t.due === ymd(new Date());
  el.innerHTML =
    '<input type="checkbox"' +
    (t.done ? " checked" : "") +
    '><span class="tx">' +
    esc(t.t) +
    "</span>" +
    (t.due
      ? '<span class="chip' + (late ? " late" : today ? " today" : "") + '">' + esc(dueLabel(t)) + "</span>"
      : "") +
    (t.cat ? '<span class="chip">' + esc(t.cat) + "</span>" : "") +
    '<button class="x">×</button>';
  el.children[0].onchange = function () {
    t.done = this.checked;
    t.doneAt = Date.now();
    saveTasks();
    renderAll();
  };
  el.children[el.children.length - 1].onclick = function () {
    tasks = tasks.filter(function (x) {
      return x !== t;
    });
    saveTasks();
    renderAll();
  };
  el.querySelector(".tx").ondblclick = function () {
    var s = this;
    var inp = document.createElement("input");
    inp.value = t.t;
    inp.style.flex = "1";
    s.replaceWith(inp);
    inp.focus();
    var fin = function (ok) {
      if (ok && inp.value.trim()) {
        t.t = inp.value.trim();
      }
      saveTasks();
      renderAll();
    };
    inp.onkeydown = function (e) {
      e.stopPropagation();
      if (e.key === "Enter" && !e.isComposing) fin(true);
      else if (e.key === "Escape") fin(false);
    };
    inp.onblur = function () {
      fin(true);
    };
  };
  return el;
}
/** ToDo の画面を描き直す(カテゴリの候補・絞り込み・未完了の一覧・完了済みの一覧)。 */
function renderTodo() {
  var cats = [];
  tasks.forEach(function (t) {
    if (t.cat && cats.indexOf(t.cat) < 0) cats.push(t.cat);
  });
  $("cats").innerHTML = cats
    .map(function (c) {
      return '<option value="' + esc(c) + '">';
    })
    .join("");
  var fc = $("fcat");
  var cur = catFilter;
  fc.innerHTML =
    '<option value="">' +
    L("すべてのカテゴリ", "All categories") +
    "</option>" +
    cats
      .map(function (c) {
        return '<option value="' + esc(c) + '">' + esc(c) + "</option>";
      })
      .join("");
  fc.value = cats.indexOf(cur) >= 0 ? cur : "";
  catFilter = fc.value;
  var vis = tasks.filter(function (t) {
    return !catFilter || t.cat === catFilter;
  });
  var open = sorted(
      vis.filter(function (t) {
        return !t.done;
      }),
    ),
    done = sorted(
      vis.filter(function (t) {
        return t.done;
      }),
    );
  var tl = $("tl");
  tl.innerHTML = "";
  if (!open.length) {
    var e = document.createElement("div");
    e.className = "dim";
    e.style.padding = "14px 4px";
    e.textContent = L("やることはありません", "Nothing to do");
    tl.appendChild(e);
  }
  open.forEach(function (t) {
    tl.appendChild(itemEl(t));
  });
  var db = $("doneBox");
  db.innerHTML = "";
  if (showDone && done.length) {
    var h = document.createElement("h4");
    h.innerHTML =
      L("完了済み", "Completed") +
      " (" +
      done.length +
      ') <button class="x" id="clrDone">' +
      L("すべて削除", "Clear all") +
      "</button>";
    db.appendChild(h);
    var l = document.createElement("div");
    l.className = "list";
    done.forEach(function (t) {
      l.appendChild(itemEl(t));
    });
    db.appendChild(l);
    $("clrDone").onclick = function () {
      tasks = tasks.filter(function (t) {
        return !t.done;
      });
      saveTasks();
      renderAll();
    };
  }
}
