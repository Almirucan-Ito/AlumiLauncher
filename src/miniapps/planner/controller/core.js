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
var tasks = [],
  events = [],
  view = { y: 0, m: 0 },
  selDate = ymd(new Date());
var sortKey = "due",
  catFilter = "",
  showDone = false;
/** ToDo を保存する。保存できる大きさ(約 30000 字)を超えたら、完了済みのものから捨てる。 */
function saveTasks() {
  var s = JSON.stringify(tasks);
  while (s.length > 30000) {
    var i = tasks.findIndex(function (t) {
      return t.done;
    });
    if (i < 0) break;
    tasks.splice(i, 1);
    s = JSON.stringify(tasks);
  }
  return store.set("tasks", s);
}
/** 予定を保存する。保存できる大きさを超えたら、日付の古いものから捨てる。 */
function saveEvents() {
  var s = JSON.stringify(events);
  while (s.length > 30000 && events.length) {
    events.sort(function (a, b) {
      return a.date < b.date ? -1 : 1;
    });
    events.shift();
    s = JSON.stringify(events);
  }
  return store.set("events", s);
}
/**
 * 期限の表示を作る。
 * @param t ToDo
 * @returns `今日` / `明日` / `月/日`。期限がなければ空
 */
function dueLabel(t) {
  if (!t.due) return "";
  var today = ymd(new Date());
  var tm = ymd(new Date(Date.now() + 864e5));
  if (t.due === today) return L("今日", "Today");
  if (t.due === tm) return L("明日", "Tomorrow");
  return t.due.slice(5).replace("-", "/");
}
/**
 * ToDo を、選んだ並び順(期限 / カテゴリ / 名前 / 作成順)で並べ替えた、新しい配列を返す。期限がないものは、後ろへ。
 * @param list ToDo の配列
 */
function sorted(list) {
  var a = list.slice();
  var dueCmp = function (x, y) {
    var xd = x.due || "9999",
      yd = y.due || "9999";
    return xd < yd ? -1 : xd > yd ? 1 : 0;
  };
  if (sortKey === "due")
    a.sort(function (x, y) {
      return dueCmp(x, y) || x.ts - y.ts;
    });
  else if (sortKey === "cat")
    a.sort(function (x, y) {
      return (x.cat || "~").localeCompare(y.cat || "~") || dueCmp(x, y);
    });
  else if (sortKey === "name")
    a.sort(function (x, y) {
      return x.t.localeCompare(y.t);
    });
  else
    a.sort(function (x, y) {
      return x.ts - y.ts;
    });
  return a;
}
