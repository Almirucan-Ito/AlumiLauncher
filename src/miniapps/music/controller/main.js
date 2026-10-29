/** 右クリックメニュー(別のプレイリストへコピー)を閉じる。 */
function hideCtx() {
  var c = document.querySelector(".ctx");
  if (c) c.remove();
}
/**
 * 曲の右クリックメニュー(別のプレイリストへコピー)を出す。
 * @param x 画面の x 座標
 * @param y 画面の y 座標
 * @param i 曲の番号
 */
function showCtx(x, y, i) {
  hideCtx();
  var others = (st.lists || [])
    .map(function (n, k) {
      return { n: n, k: k };
    })
    .filter(function (o) {
      return o.k !== st.activeList;
    });
  if (!others.length) return;
  var m = document.createElement("div");
  m.className = "ctx";
  others.forEach(function (o) {
    var it = document.createElement("div");
    it.textContent = T.copyTo.replace("{n}", o.n);
    it.onclick = function () {
      cmd("copy", { index: i, to: o.k });
      hideCtx();
    };
    m.appendChild(it);
  });
  m.style.left = Math.min(x, innerWidth - 180) + "px";
  m.style.top = Math.min(y, innerHeight - 20 - others.length * 30) + "px";
  document.body.appendChild(m);
}
addEventListener("click", hideCtx);
/**
 * プレイリストの名前の入力欄を出す。
 * @param mode `"new"`(新規)か `"rename"`(名前の変更)
 */
function openEdit(mode) {
  editMode = mode;
  $("plbar").style.display = "none";
  $("pledit").style.display = "";
  $("plname").value = mode === "rename" && st ? st.lists[st.activeList] : "";
  $("plname").focus();
  $("plname").select();
}
/** プレイリストの名前の入力欄を閉じる。 */
function closeEdit() {
  editMode = null;
  $("pledit").style.display = "none";
  $("plbar").style.display = "";
}
/** 入力した名前で、プレイリストを新しく作る/名前を変える。 */
function applyEdit() {
  var n = $("plname").value.trim();
  if (editMode === "new") cmd("list.new", { name: n });
  else if (editMode === "rename" && n) cmd("list.rename", { index: st.activeList, name: n });
  closeEdit();
}
$("plsel").onchange = function () {
  cmd("list.select", { index: Number(this.value) });
};
$("plnew").onclick = function () {
  openEdit("new");
};
$("plren").onclick = function () {
  openEdit("rename");
};
$("plok").onclick = applyEdit;
$("plcancel").onclick = closeEdit;
$("plname").addEventListener("keydown", function (e) {
  e.stopPropagation();
  if (e.key === "Enter" && !e.isComposing) applyEdit();
  else if (e.key === "Escape") closeEdit();
});
$("pldel").onclick = function () {
  var b = this;
  if (delTimer) {
    clearTimeout(delTimer);
    delTimer = null;
    b.textContent = T.pldel;
    cmd("list.delete", { index: st.activeList });
    return;
  }
  b.textContent = T.plsure;
  delTimer = setTimeout(function () {
    delTimer = null;
    b.textContent = T.pldel;
  }, 3000);
};
$("fav").onclick = function () {
  cmd("fav");
};
$("toggle").onclick = function () {
  cmd("toggle");
};
$("prev").onclick = function () {
  cmd("prev");
};
$("next").onclick = function () {
  cmd("next");
};
$("shuffle").onclick = function () {
  cmd("shuffle", { value: !(st && st.shuffle) });
};
$("repeat").onclick = function () {
  var m = st ? st.repeat : "off";
  cmd("repeat", { value: m === "off" ? "all" : m === "all" ? "one" : "off" });
};
$("mute").onclick = function () {
  cmd("mute", { value: !(st && st.muted) });
};
$("vol").oninput = function () {
  cmd("volume", { value: this.value / 100 });
};
$("rate").onchange = function () {
  cmd("rate", { value: Number(this.value) });
};
$("sleep").onchange = function () {
  cmd("sleep", { minutes: Number(this.value) });
};
$("addFiles").onclick = function () {
  cmd("addFiles");
};
$("addFolder").onclick = function () {
  cmd("addFolder");
};
$("clear").onclick = function () {
  cmd("clear");
};
$("seek").addEventListener("input", function () {
  seeking = true;
  if (st && st.duration) $("pos").textContent = fmt((this.value / 1000) * st.duration);
});
$("seek").addEventListener("change", function () {
  seeking = false;
  if (st && st.duration) cmd("seek", { sec: (this.value / 1000) * st.duration });
});
addEventListener("keydown", function (e) {
  if (e.target && (e.target.tagName === "SELECT" || (e.target.tagName === "INPUT" && e.target.type === "text"))) return;
  var k = e.key;
  if (k === " ") {
    e.preventDefault();
    cmd("toggle");
  } else if (k === "ArrowRight") {
    e.preventDefault();
    if (st) cmd("seek", { sec: st.position + 5 });
  } else if (k === "ArrowLeft") {
    e.preventDefault();
    if (st) cmd("seek", { sec: st.position - 5 });
  } else if (k === "ArrowUp") {
    e.preventDefault();
    if (st) cmd("volume", { value: Math.min(1, st.volume + 0.05) });
  } else if (k === "ArrowDown") {
    e.preventDefault();
    if (st) cmd("volume", { value: Math.max(0, st.volume - 0.05) });
  } else if (k === "n" || k === "N") cmd("next");
  else if (k === "p" || k === "P") cmd("prev");
  else if (k === "m" || k === "M") cmd("mute", { value: !(st && st.muted) });
  else if (k === "l" || k === "L") cmd("fav");
  else if (k === "Escape") call("close");
});

renderList();
call("player.state")
  .then(function (r) {
    st = r.state;
    tracks = r.tracks || [];
    render();
    renderList();
  })
  .catch(function () {});
