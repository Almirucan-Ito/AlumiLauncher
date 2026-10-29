// ---- 初期化・イベント ----
$("zsel").innerHTML = ZONES.map(function (z) {
  return '<option value="' + z + '">' + esc(tzLabel(z)) + "</option>";
}).join("");
$("zadd").textContent = L("追加", "Add");
$("zadd").onclick = function () {
  var z = $("zsel").value;
  if (zones.indexOf(z) < 0) {
    zones.push(z);
    store.set("zones", JSON.stringify(zones));
  }
  renderWorld();
};
$("swgo").onclick = function () {
  if (sw.running) {
    sw.elapsed = swNow();
    sw.running = false;
  } else {
    sw.start = Date.now();
    sw.running = true;
  }
  swSave();
  renderSw();
};
$("swlap").onclick = function () {
  sw.laps.push(swNow());
  swSave();
  renderSw();
};
$("swrst").textContent = L("リセット", "Reset");
$("swrst").onclick = function () {
  sw = { running: false, start: 0, elapsed: 0, laps: [] };
  swSave();
  renderSw();
};
$("tlb").placeholder = L("名前(省略可)", "Name (optional)");
$("hL").textContent = L("時間", "h");
$("mL").textContent = L("分", "m");
$("sL").textContent = L("秒", "s");
$("tadd").textContent = L("追加", "Add");
$("tadd").onclick = function () {
  addTimer(
    Number($("th").value || 0) * 3600 + Number($("tm").value || 0) * 60 + Number($("ts").value || 0),
    $("tlb").value.trim(),
  );
  $("tlb").value = "";
};
$("presets").innerHTML = "";
[1, 3, 5, 10, 15, 30].forEach(function (m) {
  var b = document.createElement("button");
  b.textContent = m + L("分", "m");
  b.onclick = function () {
    addTimer(m * 60, "");
  };
  $("presets").appendChild(b);
});
$("pgo").onclick = function () {
  var run = pomo.phase !== "idle" && pomo.endAt > 0;
  if (run) {
    call("alarm.cancel", { id: "pomo" }).catch(function () {});
    pFinished(pomo.phase === "focus" ? "skip" : "break", 0, Date.now());
  } else pStart(pomo.next);
};
$("pstop").textContent = L("中止", "Stop");
$("pstop").onclick = pStop;
$("todayH").textContent = L("今日の集中時間", "Focus today");
$("weekH").textContent = L("この 1 週間(分)", "Last 7 days (min)");
$("cfgH").textContent = L("時間の設定(分)", "Durations (min)");
$("cf1").textContent = L("集中", "Focus");
$("cf2").textContent = L("休憩", "Break");
$("cf3").textContent = L("長い休憩", "Long");
$("cf4").textContent = L("長い休憩までの回数", "Cycles");
/** ポモドーロの設定(各段階の長さ・回数)を、入力欄に反映する。 */
function cfgUi() {
  $("pf").value = cfg.f;
  $("ps").value = cfg.s;
  $("pl").value = cfg.l;
  $("pc").value = cfg.c;
}
[
  ["pf", "f", 1, 180],
  ["ps", "s", 1, 60],
  ["pl", "l", 1, 120],
  ["pc", "c", 2, 12],
].forEach(function (a) {
  $(a[0]).onchange = function () {
    var v = Math.max(a[2], Math.min(a[3], Math.floor(Number(this.value)) || a[2]));
    cfg[a[1]] = v;
    this.value = v;
    pSave();
    renderPomo();
  };
  $(a[0]).onkeydown = function (e) {
    e.stopPropagation();
  };
});
$("tlb").onkeydown = function (e) {
  e.stopPropagation();
  if (e.key === "Enter" && !e.isComposing) $("tadd").click();
};
["th", "tm", "ts"].forEach(function (i) {
  $(i).onkeydown = $("tlb").onkeydown;
  $(i).onfocus = function () {
    this.select();
  };
});
addEventListener("keydown", function (e) {
  if (e.key === "Escape" && !(e.target && e.target.tagName === "INPUT")) call("close");
});
// アラームが鳴った(ミニアプリが開いているとき)/ 閉じている間に鳴ったもの(開いたとき受け取る)
/**
 * アラームが鳴った(または、閉じている間に鳴っていた)ことを、タイマー・ポモドーロに反映する。
 * @param a 鳴ったアラーム(`id` / `kind` / `minutes` / `firedAt`)
 */
function handleFired(a) {
  if (a.kind === "timer") {
    var t = timers.find(function (x) {
      return "t_" + x.id === a.id;
    });
    if (t) {
      t.endAt = 0;
      t.left = 0;
      t.fin = true;
      tSave();
    }
  } else if (a.id === "pomo") pFinished(a.kind, a.minutes, a.firedAt || Date.now());
  renderAll();
}
onHost = function (d) {
  if (d.type === "alarm-fired") {
    handleFired(d.alarm);
    call("alarm.collect").catch(
      function () {},
    ); /* 開いている間に処理したものは、記録から消す(次に開いたとき、二重に数えないため) */
  }
};
setInterval(function () {
  if (cur === "world" && new Date().getMilliseconds() >= 0) renderWorld();
  else if (
    cur === "timer" &&
    timers.some(function (t) {
      return t.endAt;
    })
  )
    renderTimers();
  else if (cur === "pomo" && pomo.endAt) renderPomo();
}, 250);
Promise.all([
  store.get("zones"),
  store.get("sw"),
  store.get("timers"),
  store.get("cfg"),
  store.get("pomo"),
  store.get("log"),
]).then(function (r) {
  var z = parseJson(r[0], null);
  if (Array.isArray(z) && z.length)
    zones = z.filter(function (x) {
      return typeof x === "string";
    });
  sw = Object.assign(sw, parseJson(r[1], {}));
  timers = parseJson(r[2], []);
  if (!Array.isArray(timers)) timers = [];
  cfg = Object.assign(cfg, parseJson(r[3], {}));
  pomo = Object.assign(pomo, parseJson(r[4], {}));
  log = parseJson(r[5], {});
  if (typeof log !== "object") log = {};
  cfgUi();
  // 動いているタイマーが、閉じている間に過ぎていたら、終了にする
  timers.forEach(function (t) {
    if (t.endAt && t.endAt <= Date.now()) {
      t.endAt = 0;
      t.left = 0;
      t.fin = true;
    }
  });
  if (pomo.phase !== "idle" && pomo.endAt && pomo.endAt <= Date.now()) {
    pomo.phase = "idle";
    pomo.endAt = 0;
  }
  call("alarm.collect")
    .then(function (list) {
      (list || []).forEach(function (a) {
        if (a.kind === "timer") {
          var t = timers.find(function (x) {
            return "t_" + x.id === a.id;
          });
          if (t) {
            t.endAt = 0;
            t.left = 0;
            t.fin = true;
          }
        } else if (a.id === "pomo") pFinished(a.kind, a.minutes, a.firedAt || Date.now());
      });
      tSave();
      show();
    })
    .catch(function () {
      show();
    });
});
show();
