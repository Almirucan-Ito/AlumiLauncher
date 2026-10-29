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
var COLORS = ["#fde68a", "#fecaca", "#bbf7d0", "#bfdbfe", "#e9d5ff", "#fed7aa"];
var files = [],
  cur = null /* {path,name} または null=新規 */,
  dirty = false,
  autoTimer = null,
  stickies = [];
/**
 * タブ(メモ帳 / 付箋ボード)を切り替える。
 * @param t `"pad"`(メモ帳)か `"board"`(付箋ボード)
 */
function setTab(t) {
  document.querySelectorAll(".tab").forEach(function (b) {
    b.classList.toggle("on", b.dataset.t === t);
  });
  $("v-pad").style.display = t === "pad" ? "" : "none";
  $("v-board").style.display = t === "board" ? "" : "none";
  if (t === "pad") $("body").focus();
}
document.querySelectorAll(".tab").forEach(function (b) {
  b.onclick = function () {
    setTab(b.dataset.t);
  };
});
$("tabPad").textContent = L("メモ帳", "Notepad");
$("tabBoard").textContent = L("付箋ボード", "Sticky board");
$("newBtn").textContent = L("＋ 新しいメモ", "+ New note");
$("title").placeholder = L("タイトル(省略できます)", "Title (optional)");
$("body").placeholder = L("ここにメモを書きます…", "Write your note here…");
$("addNote").textContent = L("＋ 付箋", "+ Sticky");
$("boardHint").textContent = L("色を選んで、ホームへ書き出せます", "Pick a color, or export to Home");
// ---------- メモ帳 ----------
/** 文字数・保存ボタンの文言(上書き保存 / 保存してホームに追加)・タイトル欄の編集可否を、いまの状態に合わせて更新する。 */
function refresh() {
  $("cnt").textContent =
    $("body").value.length + L(" 文字", " chars") + (dirty && cur ? L("(未保存)", " (unsaved)") : "");
  $("saveBtn").textContent = cur ? L("上書き保存", "Save") : L("保存してホームに追加", "Save to Home");
  $("saveBtn").disabled = !$("body").value.trim() && !cur;
  $("title").readOnly = !!cur;
  if (cur) $("title").value = cur.name;
}
/**
 * ホームのテキストファイル(.txt / .md)の一覧を取得して、左の一覧に出す。
 * @param sel 一覧を出したあと、選んでおくファイル名(省略可)
 */
function listFiles(sel) {
  return call("home.texts")
    .then(function (l) {
      files = l || [];
      var el = $("files");
      el.innerHTML = "";
      if (!files.length) {
        var e = document.createElement("div");
        e.className = "file dim";
        e.textContent = L("テキストはありません", "No text files");
        el.appendChild(e);
      }
      files.forEach(function (f) {
        var d = document.createElement("div");
        d.className = "file" + (cur && cur.path === f.path ? " cur" : "");
        d.textContent = f.name;
        d.title = f.name;
        d.onclick = function () {
          openFile(f);
        };
        el.appendChild(d);
        if (sel && sel === f.name) openFile(f);
      });
    })
    .catch(function () {});
}
/**
 * 編集中のファイルに、未保存の変更があれば、すぐ上書き保存する(自動保存のタイマーも止める)。
 * @returns 保存が終わったら解決する約束(失敗したときは、未保存のまま)
 */
function flushNow() {
  clearTimeout(autoTimer);
  if (cur && dirty) {
    dirty = false;
    return call("home.write", { path: cur.path, content: $("body").value }).catch(function () {
      dirty = true;
    });
  }
  return Promise.resolve();
}
/**
 * 一覧のファイルを開いて、編集できるようにする(いま編集中のものは、先に保存する)。
 * @param f `{ path, name }`
 */
function openFile(f) {
  flushNow()
    .then(function () {
      return call("home.read", { path: f.path });
    })
    .then(function (txt) {
      cur = { path: f.path, name: f.name };
      $("body").value = txt || "";
      dirty = false;
      refresh();
      document.querySelectorAll(".file").forEach(function (e) {
        e.classList.toggle("cur", e.textContent === f.name);
      });
      $("body").focus();
    })
    .catch(function () {});
}
/** 新しいメモを書き始める(いま編集中のものは、先に保存する)。前回の下書きがあれば、戻す。 */
function newNote() {
  flushNow().then(function () {
    cur = null;
    $("title").value = "";
    $("body").value = "";
    dirty = false;
    refresh();
    document.querySelectorAll(".file").forEach(function (e) {
      e.classList.remove("cur");
    });
    store.get("draft").then(function (v) {
      var d = parseJson(v, null);
      if (d) {
        $("title").value = d.title || "";
        $("body").value = d.body || "";
        refresh();
      }
    });
    $("title").focus();
  });
}
/** 新規メモの下書き(タイトルと本文)を保存する。ファイルを開いていないときだけ。 */
function draft() {
  if (!cur) store.set("draft", JSON.stringify({ title: $("title").value, body: $("body").value }));
}
/** 保存する。ファイルを開いているときは、上書き保存。新規メモは、ホームに新しいテキストファイルとして書き出す(本文が空なら何もしない)。 */
function save() {
  if (cur) {
    flushNow().then(function () {
      dirty = false;
      refresh();
      call("toast", { message: L("保存しました", "Saved") }).catch(function () {});
    });
    return;
  }
  if (!$("body").value.trim()) return;
  call("saveText", { title: $("title").value, content: $("body").value })
    .then(function (r) {
      $("title").value = "";
      $("body").value = "";
      store.set("draft", "");
      call("toast", { message: L("ホームに追加しました: ", "Added to Home: ") + (r && r.name ? r.name : "") }).catch(
        function () {},
      );
      listFiles(r && r.name);
    })
    .catch(function () {});
}
$("body").addEventListener("input", function () {
  if (cur) {
    dirty = true;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(flushNow, 1200);
  } else {
    clearTimeout(autoTimer);
    autoTimer = setTimeout(draft, 500);
  }
  refresh();
});
$("title").addEventListener("input", function () {
  if (!cur) {
    clearTimeout(autoTimer);
    autoTimer = setTimeout(draft, 500);
  }
  refresh();
});
$("body").addEventListener("blur", flushNow);
$("newBtn").onclick = newNote;
$("saveBtn").onclick = save;
// ---------- 付箋ボード ----------
/** 付箋を保存する。保存できる大きさ(約 30000 字)を超えたら、古いものから捨てる。 */
function saveStickies() {
  var s = JSON.stringify(stickies);
  while (s.length > 30000 && stickies.length > 1) {
    stickies.sort(function (a, b) {
      return a.ts - b.ts;
    });
    stickies.shift();
    s = JSON.stringify(stickies);
  }
  store.set("stickies", s);
}
/** 付箋の保存を、500ms 後に予約する(入力のたびに保存しないため)。 */
var stTimer = null;
function stSoon() {
  clearTimeout(stTimer);
  stTimer = setTimeout(saveStickies, 500);
}
/** 付箋ボードを描き直す(新しい順)。付箋ごとに、本文の編集・色の変更・「書き出し」(テキストファイルとしてホームへ)・削除ができる。 */
function renderBoard() {
  var b = $("board");
  b.innerHTML = "";
  if (!stickies.length) {
    var e = document.createElement("div");
    e.className = "dim";
    e.style.padding = "18px 4px";
    e.textContent = L("付箋はありません。「＋ 付箋」で追加してください", "No stickies yet. Press + Sticky.");
    b.appendChild(e);
  }
  stickies
    .slice()
    .sort(function (a, c) {
      return c.ts - a.ts;
    })
    .forEach(function (n) {
      var el = document.createElement("div");
      el.className = "note";
      el.style.background = n.color;
      el.innerHTML =
        '<textarea maxlength="1000" spellcheck="false"></textarea><div class="ft"><span class="cols"></span><span class="sp"></span><button class="ex"></button><button class="dl">×</button></div>';
      var ta = el.querySelector("textarea");
      ta.value = n.text;
      ta.placeholder = L("ここに書く…", "Write…");
      ta.oninput = function () {
        n.text = ta.value;
        n.ts = Date.now();
        stSoon();
      };
      ta.onkeydown = function (e) {
        e.stopPropagation();
      };
      var cols = el.querySelector(".cols");
      COLORS.forEach(function (c) {
        var d = document.createElement("button");
        d.className = "cd";
        d.style.setProperty("--c", c);
        d.onclick = function () {
          n.color = c;
          el.style.background = c;
          saveStickies();
        };
        cols.appendChild(d);
      });
      var ex = el.querySelector(".ex");
      ex.textContent = L("書き出し", "Export");
      ex.onclick = function () {
        var first = (n.text || "").split(/\r?\n/)[0].slice(0, 20);
        if (!n.text.trim()) return;
        call("saveText", { title: first, content: n.text })
          .then(function (r) {
            call("toast", {
              message: L("ホームに追加しました: ", "Added to Home: ") + (r && r.name ? r.name : ""),
            }).catch(function () {});
          })
          .catch(function () {});
      };
      el.querySelector(".dl").onclick = function () {
        stickies = stickies.filter(function (x) {
          return x !== n;
        });
        saveStickies();
        renderBoard();
      };
      b.appendChild(el);
    });
}
$("addNote").onclick = function () {
  stickies.push({ id: uid(), text: "", color: COLORS[stickies.length % COLORS.length], ts: Date.now() });
  if (stickies.length > 30) stickies.shift();
  saveStickies();
  renderBoard();
  var t = document.querySelector(".note textarea");
  if (t) t.focus();
};
addEventListener("keydown", function (e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    save();
  } else if (e.key === "Escape") {
    flushNow().then(function () {
      draft();
      call("close");
    });
  }
});
store.get("stickies").then(function (v) {
  var a = parseJson(v, []);
  stickies = Array.isArray(a) ? a : [];
  renderBoard();
});
newNote();
listFiles();
