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
var hits = [],
  cur = 0,
  timer = null,
  token = 0;
$("q").placeholder = L("名前を入力(ホームとフォルダの中を探します)", "Type a name (searches Home and folders)");
/**
 * 名前から、頭文字のバッジの色(HSL)を決める。
 * @param s 名前
 */
function color(s) {
  var h = 0;
  for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return "hsl(" + h + ",55%,45%)";
}
/** 検索結果の一覧を描き直す(件数・選択中の行・頭文字のバッジ・見つけた場所)。 */
function render() {
  var r = $("res");
  r.innerHTML = "";
  if (!$("q").value.trim()) {
    r.innerHTML =
      '<div class="msg">' +
      L("探したいアイコンの名前を入力してください", "Type the name of an icon to find") +
      "</div>";
    $("count").textContent = "";
    return;
  }
  $("count").textContent = hits.length + L(" 件", " results");
  if (!hits.length) {
    r.innerHTML = '<div class="msg">' + L("見つかりませんでした", "No matches") + "</div>";
    return;
  }
  hits.forEach(function (h, i) {
    var el = document.createElement("div");
    el.className = "hit" + (i === cur ? " cur" : "");
    var nm = h.name.replace(/\.(lnk|url|alumiapp)$/i, "");
    el.innerHTML =
      '<span class="badge" style="background:' +
      color(nm) +
      '">' +
      esc(nm.charAt(0).toUpperCase()) +
      '</span><span class="nm">' +
      esc(nm) +
      '</span><span class="where">' +
      esc(h.where) +
      "</span>";
    el.onclick = function () {
      go(i);
    };
    r.appendChild(el);
  });
  var c = r.querySelector(".cur");
  if (c) c.scrollIntoView({ block: "nearest" });
}
/**
 * 結果を起動して、ミニアプリを閉じる。
 * @param i 結果の番号
 */
function go(i) {
  var h = hits[i];
  if (!h) return;
  call("launcher.launch", { path: h.path })
    .then(function () {
      call("close");
    })
    .catch(function () {});
}
/** 入力した文字で、ホームと登録したフォルダの中のアイコンを探す(古い検索の結果は、捨てる)。 */
function search() {
  var q = $("q").value,
    my = ++token;
  if (!q.trim()) {
    hits = [];
    cur = 0;
    render();
    return;
  }
  call("launcher.search", { q: q })
    .then(function (r) {
      if (my !== token) return;
      hits = r || [];
      cur = 0;
      render();
    })
    .catch(function () {});
}
$("q").addEventListener("input", function () {
  clearTimeout(timer);
  timer = setTimeout(search, 120);
});
addEventListener("keydown", function (e) {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    cur = Math.min(hits.length - 1, cur + 1);
    render();
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    cur = Math.max(0, cur - 1);
    render();
  } else if (e.key === "Enter" && !e.isComposing) {
    go(cur);
  } else if (e.key === "Escape") {
    if ($("q").value) {
      $("q").value = "";
      search();
    } else call("close");
  }
});
render();
$("q").focus();
