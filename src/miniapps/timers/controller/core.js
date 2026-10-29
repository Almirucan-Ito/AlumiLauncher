var seq = 0,
  waiting = {};
/**
 * ランチャー(親の画面)へ、機能の呼び出しを送って、結果を待つ(postMessage の窓口)。60 秒で時間切れになる。
 * @param m 呼び出す機能の名前(例: `storage.get` / `saveText` / `close`)
 * @param p 機能に渡す値
 * @returns 結果の約束(Promise)。失敗や許可がないときは、拒否される
 */
function call(m, p) {
  return new Promise(function (res, rej) {
    var id = ++seq;
    waiting[id] = { res: res, rej: rej };
    parent.postMessage({ alumi: 1, id: id, method: m, params: p || {} }, "*");
    setTimeout(function () {
      if (waiting[id]) {
        delete waiting[id];
        rej(new Error("timeout"));
      }
    }, 60000);
  });
}
var onHost = function (d) {};
addEventListener("message", function (e) {
  var d = e.data;
  if (!d || d.alumi !== 1) return;
  if (d.id && waiting[d.id]) {
    var w = waiting[d.id];
    delete waiting[d.id];
    d.ok ? w.res(d.result) : w.rej(new Error(d.error || "error"));
    return;
  }
  if (d.type === "theme") {
    var r = document.documentElement.style;
    ["text", "bg", "dim", "field", "stroke"].forEach(function (k) {
      if (d[k]) r.setProperty("--" + k, d[k]);
    });
  } else onHost(d);
});
var store = {
  get: function (k) {
    return call("storage.get", { key: k }).catch(function () {
      return null;
    });
  },
  set: function (k, v) {
    return call("storage.set", { key: k, value: v }).catch(function () {});
  },
};
var JA = (navigator.language || "ja").toLowerCase().indexOf("ja") === 0;
/**
 * 表示言語(日本語か、それ以外か)に合わせて、文言を選ぶ。
 * @param ja 日本語のとき
 * @param en それ以外のとき
 */
function L(ja, en) {
  return JA ? ja : en;
}
/** ID から要素を取る。 */
function $(id) {
  return document.getElementById(id);
}
/**
 * HTML に埋め込むために、特殊な文字(`& < > "`)を無害な形にする。
 * @param s 文字列
 */
function esc(s) {
  return String(s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}
/** 一意になりやすい ID(時刻 + 乱数)を作る。 */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
/**
 * JSON を読む。壊れている・null のときは、代わりの値を返す。
 * @param v JSON の文字列
 * @param fb 読めなかったときの値
 */
function parseJson(v, fb) {
  try {
    var x = JSON.parse(v);
    return x == null ? fb : x;
  } catch (e) {
    return fb;
  }
}
/**
 * 日付を `YYYY-MM-DD` の文字列にする(ローカル時刻)。
 * @param d 日付
 */
function ymd(d) {
  return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
}
var ZONES = [
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Africa/Cairo",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Pacific/Honolulu",
  "Australia/Sydney",
  "Pacific/Auckland",
  "UTC",
];
var tabs = [
  ["world", L("世界時計", "World clock")],
  ["sw", L("ストップウォッチ", "Stopwatch")],
  ["timer", L("タイマー", "Timers")],
  ["pomo", L("ポモドーロ", "Pomodoro")],
];
var cur = "world",
  zones = ["Asia/Tokyo", "America/New_York", "Europe/London", "America/Los_Angeles"],
  sw = { running: false, start: 0, elapsed: 0, laps: [] },
  timers = [],
  cfg = { f: 25, s: 5, l: 15, c: 4 },
  pomo = { phase: "idle", endAt: 0, cycle: 1, next: "focus" },
  log = {};
/**
 * タイムゾーン名を、表示用の都市名にする(`Asia/Tokyo` → `Tokyo`)。
 * @param z タイムゾーン名
 */
function tzLabel(z) {
  return z === "UTC" ? "UTC" : z.split("/").pop().replace(/_/g, " ");
}
/**
 * あるタイムゾーンの、UTC からのずれ(分)を求める。
 * @param tz タイムゾーン名
 * @param date 日付(夏時間を考えるため)
 */
function offMin(tz, date) {
  var f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(date),
    o = {};
  f.forEach(function (p) {
    o[p.type] = p.value;
  });
  return Math.round(
    (Date.UTC(o.year, o.month - 1, o.day, o.hour, o.minute, o.second) - Math.floor(date.getTime() / 1000) * 1000) /
      60000,
  );
}
/**
 * 分を、`+9` / `-5:30` のような、時差の表示にする。
 * @param m 分
 */
function fmtHM(m) {
  var s = m < 0 ? "-" : "+";
  m = Math.abs(m);
  return s + Math.floor(m / 60) + (m % 60 ? ":" + ("0" + (m % 60)).slice(-2) : "");
}
/** タブのボタン(世界時計・ストップウォッチ・タイマー・ポモドーロ)を作り直す。 */
function tabsUi() {
  var t = $("tabs");
  t.innerHTML = "";
  tabs.forEach(function (x) {
    var b = document.createElement("button");
    b.className = "tab" + (cur === x[0] ? " on" : "");
    b.textContent = x[1];
    b.onclick = function () {
      cur = x[0];
      show();
    };
    t.appendChild(b);
  });
}
/** いまのタブの画面だけを出して、中身を描く。 */
function show() {
  swLen = 0;
  tabsUi();
  tabs.forEach(function (x) {
    $("v-" + x[0]).style.display = cur === x[0] ? "" : "none";
  });
  renderAll();
}
