/**
 * 秒数を `分:秒` の文字列にする。
 * @param s 秒数
 */
function fmt(s) {
  s = Math.max(0, Math.floor(s || 0));
  return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2);
}

/** 曲の一覧を描き直す(いま選んでいる曲の強調・マイリストの印・ドラッグでの並べ替え・削除ボタン)。 */
function renderList() {
  var el = $("list");
  el.innerHTML = "";
  if (!tracks.length) {
    var e = document.createElement("div");
    e.className = "empty";
    e.textContent = T.empty;
    el.appendChild(e);
    return;
  }
  tracks.forEach(function (name, i) {
    var r = document.createElement("div");
    r.className = "row" + (st && st.index === i ? " cur" : "");
    r.draggable = true;
    r.dataset.i = i;
    r.innerHTML =
      '<span class="n"></span><span class="t"></span><button class="f"></button><button class="x">×</button>';
    r.children[0].textContent = i + 1;
    r.children[1].textContent = name.n;
    r.title = name.n;
    var fb = r.children[2];
    fb.textContent = name.f ? "♥" : "♡";
    fb.classList.toggle("on", !!name.f);
    fb.title = name.f ? T.favOn : T.favOff;
    r.addEventListener("click", function (e) {
      var c = e.target.className || "";
      if (c.indexOf("x") === 0) {
        e.stopPropagation();
        cmd("remove", { index: i });
      } else if (c.indexOf("f") === 0) {
        e.stopPropagation();
        cmd("fav", { index: i });
      } else cmd("play", { index: i });
    });
    r.addEventListener("contextmenu", function (e) {
      e.preventDefault();
      showCtx(e.clientX, e.clientY, i);
    });
    r.addEventListener("dragstart", function () {
      dragFrom = i;
      r.classList.add("drag");
    });
    r.addEventListener("dragend", function () {
      dragFrom = -1;
      r.classList.remove("drag");
      [].forEach.call(el.children, function (c) {
        c.classList.remove("over");
      });
    });
    r.addEventListener("dragover", function (e) {
      e.preventDefault();
      r.classList.add("over");
    });
    r.addEventListener("dragleave", function () {
      r.classList.remove("over");
    });
    r.addEventListener("drop", function (e) {
      e.preventDefault();
      if (dragFrom >= 0 && dragFrom !== i) cmd("move", { from: dragFrom, to: i });
    });
    el.appendChild(r);
  });
  var cur = el.querySelector(".cur");
  if (cur) cur.scrollIntoView({ block: "nearest" });
}

/** プレーヤーの状態(曲名・再生位置・音量・再生/一時停止・シャッフル・リピート・速度・おやすみタイマー・プレイリスト)を、画面に反映する。 */
function render() {
  if (!st) return;
  $("title").textContent = st.title || T.none;
  $("sub").textContent = T.sub.replace("{n}", st.count);
  $("pos").textContent = fmt(st.position);
  $("dur").textContent = fmt(st.duration);
  if (!seeking) $("seek").value = st.duration ? Math.round((st.position / st.duration) * 1000) : 0;
  $("ico-play").style.display = st.playing ? "none" : "";
  $("ico-pause").style.display = st.playing ? "" : "none";
  $("shuffle").classList.toggle("on", st.shuffle);
  $("repeat").classList.toggle("on", st.repeat !== "off");
  $("rep1").style.display = st.repeat === "one" ? "" : "none";
  $("vol").value = Math.round((st.muted ? 0 : st.volume) * 100);
  $("ico-vol").innerHTML =
    st.muted || st.volume === 0
      ? '<path d="M3 9v6h4l5 5V4L7 9zM16 9l5 6m0-6l-5 6" stroke="currentColor" stroke-width="2" fill="none"/>'
      : '<path d="M3 9v6h4l5 5V4L7 9zM16 8.5a5 5 0 0 1 0 7l-1.4-1.4a3 3 0 0 0 0-4.2z"/>';
  $("rate").value = String(st.rate);
  $("sleepLeft").textContent = st.sleepLeft === null ? "" : T.left + " " + fmt(st.sleepLeft);
  if (st.sleepLeft === null) $("sleep").value = "0";
  document.title = st.title || "ミュージック";
  var names = (st.lists || []).join("\n");
  if (names !== listNames) {
    listNames = names;
    var sel = $("plsel");
    sel.innerHTML = "";
    (st.lists || []).forEach(function (n, i) {
      var o = document.createElement("option");
      o.value = i;
      o.textContent = (i === 0 ? "♥ " : "") + n;
      sel.appendChild(o);
    });
  }
  $("plsel").value = String(st.activeList);
  $("plnew").disabled = (st.lists || []).length >= 9;
  // 0 番は「マイリスト」(名前を変えられない・消せない)
  $("plren").disabled = $("pldel").disabled = st.activeList === 0;
  $("fav").textContent = st.fav ? "♥" : "♡";
  $("fav").classList.toggle("on", !!st.fav);
  $("fav").title = st.fav ? T.favOn : T.favOff;
  $("fav").style.visibility = st.index >= 0 ? "" : "hidden";
}

addEventListener("message", function (e) {
  var d = e.data;
  if (!d || d.alumi !== 1) return;
  if (d.id && waiting[d.id]) {
    var w = waiting[d.id];
    delete waiting[d.id];
    d.ok ? w.resolve(d.result) : w.reject(new Error(d.error || "error"));
    return;
  }
  if (d.type === "theme") {
    var r = document.documentElement.style;
    if (d.text) r.setProperty("--text", d.text);
    if (d.bg) r.setProperty("--bg", d.bg);
    if (d.dim) r.setProperty("--dim", d.dim);
    if (d.field) r.setProperty("--field", d.field);
    if (d.stroke) r.setProperty("--stroke", d.stroke);
  } else if (d.type === "player") {
    var prev = st ? st.index : -2;
    st = d.state;
    render();
    if (prev !== st.index) renderList();
    else {
      var c = $("list").querySelector(".cur");
      if (!c && st.index >= 0) renderList();
    }
  } else if (d.type === "player-tracks") {
    tracks = d.tracks || [];
    renderList();
  }
});
