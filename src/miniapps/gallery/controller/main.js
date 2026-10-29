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
var imgs = [],
  idx = 0,
  playing = null,
  order = null;
$("bFolder").textContent = L("フォルダを開く", "Open folder");
$("bFiles").textContent = L("ファイルを開く", "Open files");
$("bLast").textContent = L("前回のフォルダ", "Last folder");
$("shufL").textContent = L("ランダム", "Shuffle");
$("close").textContent = L("閉じる", "Close");
/** 画像の一覧(見本の画像)を描き直す。枚数も出す。 */
function renderGrid() {
  var g = $("grid");
  g.innerHTML = "";
  $("cnt").textContent = imgs.length ? imgs.length + L(" 枚", " images") : "";
  if (!imgs.length) {
    g.innerHTML =
      '<div class="msg" style="grid-column:1/-1">' +
      L(
        "「フォルダを開く」で、写真のフォルダを選んでください<br>(サブフォルダの中も探します)",
        "Choose a folder of photos with “Open folder”<br>(subfolders are included)",
      ) +
      "</div>";
    return;
  }
  imgs.forEach(function (im, i) {
    var d = document.createElement("div");
    d.className = "th";
    var t = document.createElement("img");
    t.loading = "lazy";
    t.decoding = "async";
    t.alt = "";
    t.src = im.thumb;
    t.onerror = function () {
      if (t.src !== im.url) t.src = im.url;
    };
    d.appendChild(t);
    d.title = im.name;
    d.onclick = function () {
      openView(i);
    };
    g.appendChild(d);
  });
}
/**
 * 画像を選ぶ(ランチャーのダイアログ)。選んだ画像を一覧にする。
 * @param mode `"folder"`(フォルダ)/ `"files"`(ファイル)/ `"last"`(前回の選び方で、自動的に)
 */
function pick(mode) {
  call("images.pick", { mode: mode })
    .then(function (r) {
      if (r && r.length) {
        imgs = r;
        renderGrid();
      } else if (mode !== "last") {
      }
    })
    .catch(function () {});
}
$("bFolder").onclick = function () {
  pick("folder");
};
$("bFiles").onclick = function () {
  pick("files");
};
$("bLast").onclick = function () {
  pick("last");
};
// ---- 拡大・スライドショー ----
/**
 * 拡大表示で、`i` 番目の画像を出す(端は、反対側へ回る)。
 * @param i 画像の番号
 */
function showAt(i) {
  idx = (i + imgs.length) % imgs.length;
  var im = imgs[idx];
  $("big").src = im.url;
  $("cap").textContent = idx + 1 + " / " + imgs.length + "  " + im.name;
  $("viewer").classList.remove("zoom");
  var nx = imgs[(idx + 1) % imgs.length];
  if (nx) {
    var p = new Image();
    p.src = nx.url;
  }
}
/**
 * 拡大表示を開く。
 * @param i 最初に出す画像の番号
 */
function openView(i) {
  if (!imgs.length) return;
  $("viewer").style.display = "flex";
  showAt(i);
  $("play").textContent = L("▶ スライドショー", "▶ Slideshow");
  $("viewer").focus();
}
/** 拡大表示を閉じる(スライドショーも止める)。 */
function closeView() {
  stopShow();
  $("viewer").style.display = "none";
  $("big").removeAttribute("src");
}
/**
 * 前後の画像へ進む。シャッフルがオンで、進む向きのときは、無作為に選ぶ。
 * @param d 進む数(+1 で次、-1 で前)
 */
function step(d) {
  if ($("shuf").checked && d > 0 && imgs.length > 1) {
    var n;
    do n = Math.floor(Math.random() * imgs.length);
    while (n === idx);
    showAt(n);
  } else showAt(idx + d);
}
/** スライドショーを始める(選んだ間隔で、次の画像へ)。 */
function startShow() {
  stopShow();
  playing = setInterval(
    function () {
      step(1);
    },
    Number($("iv").value) * 1000,
  );
  $("play").textContent = L("⏸ 停止", "⏸ Stop");
}
/** スライドショーを止める。 */
function stopShow() {
  if (playing) {
    clearInterval(playing);
    playing = null;
  }
  $("play").textContent = L("▶ スライドショー", "▶ Slideshow");
}
$("play").onclick = function () {
  playing ? stopShow() : startShow();
};
$("iv").onchange = function () {
  if (playing) startShow();
};
$("prev").onclick = function () {
  step(-1);
};
$("next").onclick = function () {
  step(1);
};
$("close").onclick = closeView;
$("big").onclick = function () {
  $("viewer").classList.toggle("zoom");
};
addEventListener("keydown", function (e) {
  var open = $("viewer").style.display === "flex";
  if (e.key === "Escape") {
    if (open) closeView();
    else call("close");
  } else if (open && e.key === "ArrowRight") step(1);
  else if (open && e.key === "ArrowLeft") step(-1);
  else if (open && e.key === " ") {
    e.preventDefault();
    playing ? stopShow() : startShow();
  }
});
renderGrid();
pick("last");
