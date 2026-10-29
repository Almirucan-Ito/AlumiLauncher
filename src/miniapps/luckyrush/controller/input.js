// ---- 操作 ----
$("spin").onclick = function () {
  play();
};
$("oBtn").onclick = function () {
  $("over").classList.remove("on");
  setChain(0);
  msg("");
  reelEls.forEach(function (e) {
    e.classList.remove("hit");
  });
};
$("infoBtn").onclick = function () {
  buildInfo();
  $("infoP").classList.add("on");
};
$("infoClose").onclick = function () {
  $("infoP").classList.remove("on");
};
$("auto").onclick = function () {
  st.auto = !st.auto;
  this.classList.toggle("on", st.auto);
  if (st.auto && !st.busy && st.mode !== "rush" && !$("over").classList.contains("on")) play();
};
$("turbo").onclick = function () {
  st.turbo = !st.turbo;
  this.classList.toggle("on", st.turbo);
  store.set("turbo", st.turbo ? 1 : 0);
};
var volSave = 0;
$("vol").oninput = function () {
  setVol(this.value / 100);
  clearTimeout(volSave);
  volSave = setTimeout(function () {
    store.set("vol", Math.round(st.vol * 100));
  }, 400);
  if (st.vol > 0 && !st.sound) {
    st.sound = true;
    $("snd").textContent = "🔊";
  }
  SE.tick();
};
$("snd").onclick = function () {
  st.sound = !st.sound;
  this.textContent = st.sound ? "🔊" : "🔇";
  store.set("sound", st.sound ? 1 : 0);
};
// ボタンにフォーカスが残っていると、SPACE がそのボタンも押してしまう(AUTO が切り替わる)ので、押したあとはフォーカスを外す
[].forEach.call(document.querySelectorAll("button"), function (b) {
  b.addEventListener("click", function () {
    b.blur();
  });
});
addEventListener("keyup", function (e) {
  if (e.key === " " || e.key === "Enter") e.preventDefault();
});
addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    if ($("infoP").classList.contains("on")) $("infoClose").click();
    else call("close");
    return;
  }
  if (e.key === " " || e.key === "Enter") {
    e.preventDefault();
    if ($("over").classList.contains("on")) $("oBtn").click();
    else if ($("infoP").classList.contains("on")) $("infoClose").click();
    else play();
  }
});
