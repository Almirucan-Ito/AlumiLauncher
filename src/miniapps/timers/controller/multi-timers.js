// ---- タイマー(複数) ----
/**
 * タイマーの残り秒数。
 * @param t タイマー
 * @returns 動いていれば、終了時刻までの秒数(切り上げ)。止まっていれば、止めたときの残り
 */
function tLeft(t) {
  return t.endAt ? Math.max(0, Math.ceil((t.endAt - Date.now()) / 1000)) : t.left;
}
/** 秒数を `[時:]分:秒` の文字列にする。 */
function fmtT(s) {
  var h = Math.floor(s / 3600),
    m = Math.floor(s / 60) % 60;
  return (h ? h + ":" : "") + ("0" + m).slice(-2) + ":" + ("0" + (s % 60)).slice(-2);
}
/** タイマーの一覧を保存する。 */
function tSave() {
  store.set("timers", JSON.stringify(timers));
}
/** タイマーの一覧を描き直す(名前・設定した時間・残り・開始/一時停止・リセット・削除)。終了したものは「終了」と出す。 */
function renderTimers() {
  var l = $("tl");
  l.innerHTML = "";
  if (!timers.length) {
    l.innerHTML =
      '<div class="dim" style="padding:14px 4px">' +
      L("タイマーはありません。上で追加してください", "No timers. Add one above.") +
      "</div>";
  }
  timers.forEach(function (t) {
    var left = tLeft(t),
      run = !!t.endAt,
      fin = t.fin;
    var c = document.createElement("div");
    c.className = "card" + (fin ? " fin" : "");
    c.innerHTML =
      '<div class="lb"><div>' +
      esc(t.label || fmtDur(tTotal(t))) +
      '</div><div class="dim" style="font-size:12px">' +
      fmtDur(tTotal(t)) +
      '</div></div><div class="tm">' +
      (fin ? L("終了", "Done") : fmtT(left)) +
      '</div><button class="go primary">' +
      (run ? L("一時停止", "Pause") : L("開始", "Start")) +
      '</button><button class="rs">' +
      L("リセット", "Reset") +
      '</button><button class="x">×</button>';
    c.querySelector(".go").onclick = function () {
      if (run) {
        t.left = tLeft(t);
        t.endAt = 0;
        call("alarm.cancel", { id: "t_" + t.id }).catch(function () {});
      } else {
        if (fin || t.left <= 0) {
          t.left = tTotal(t);
          t.fin = false;
        }
        t.endAt = Date.now() + t.left * 1000;
        call("alarm.set", {
          id: "t_" + t.id,
          at: t.endAt,
          label: t.label || fmtDur(tTotal(t)),
          kind: "timer",
          minutes: Math.ceil(tTotal(t) / 60),
        }).catch(function () {});
      }
      tSave();
      renderTimers();
    };
    c.querySelector(".rs").onclick = function () {
      t.endAt = 0;
      t.left = tTotal(t);
      t.fin = false;
      call("alarm.cancel", { id: "t_" + t.id }).catch(function () {});
      tSave();
      renderTimers();
    };
    c.querySelector(".x").onclick = function () {
      call("alarm.cancel", { id: "t_" + t.id }).catch(function () {});
      timers = timers.filter(function (x) {
        return x !== t;
      });
      tSave();
      renderTimers();
    };
    l.appendChild(c);
  });
}
/**
 * タイマーに設定した時間(秒)。以前の形式(分だけ持つもの)にも対応する。
 * @param t タイマー
 */
function tTotal(t) {
  return t.sec || t.minutes * 60;
}
/** 時間(秒)を、`1 時間 2 分 3 秒` のような、読みやすい文字列にする(0 の単位は省く)。 */
function fmtDur(s) {
  var h = Math.floor(s / 3600),
    m = Math.floor(s / 60) % 60,
    x = s % 60,
    o = [];
  if (h) o.push(h + L(" 時間", " h"));
  if (m) o.push(m + L(" 分", " min"));
  if (x || !o.length) o.push(x + L(" 秒", " s"));
  return o.join(" ");
}
/**
 * タイマーを 1 つ追加する(1 秒〜99 時間 59 分 59 秒。12 個まで。超えたら古いものから消す)。
 * @param sec 秒数(0 以下なら何もしない)
 * @param label 名前(省略可)
 */
function addTimer(sec, label) {
  sec = Math.max(1, Math.min(99 * 3600 + 3599, Math.floor(Number(sec)) || 0));
  if (!sec) return;
  timers.push({
    id: uid(),
    label: label || "",
    sec: sec,
    minutes: Math.ceil(sec / 60),
    left: sec,
    endAt: 0,
    fin: false,
  });
  if (timers.length > 12) timers.shift();
  tSave();
  renderTimers();
}
