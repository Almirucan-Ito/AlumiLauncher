/*
 * ミニアプリのひな形。同梱のミニアプリ(メモ・予定とToDo など)と同じ、次の並びで書く:
 *   1. ランチャーとの窓口(call / store)   2. 小さな道具(L / $ / esc など)   3. 状態   4. 描画   5. 操作   6. 起動
 * ・ランチャーの機能は、miniapp.json の permissions に書いたものだけが使える(この見本は storage だけ)
 * ・保存したデータは、このミニアプリのフォルダの data フォルダに、キーごとのファイルとして残る
 * ・外部のサーバーと通信したいときは、miniapp.json に "network": true と書く(初めて使うとき、利用者の同意が要る)
 */

// ==== 1. ランチャーとの窓口(postMessage) ====
var seq = 0,
  waiting = {};
/**
 * ランチャー(親の画面)へ、機能の呼び出しを送って、結果を待つ。60 秒で時間切れ。
 * @param m 機能の名前(例: `storage.get` / `storage.set` / `toast` / `close`)
 * @param p 渡す値
 * @returns 結果の約束(Promise)。許可がない・失敗したときは、拒否される
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
/** ランチャーからのメッセージ: 呼び出しの結果と、色(theme)の知らせ */
addEventListener("message", function (e) {
  var d = e.data;
  if (!d || d.alumi !== 1) return;
  if (d.id && waiting[d.id]) {
    var w = waiting[d.id];
    delete waiting[d.id];
    d.ok ? w.res(d.result) : w.rej(new Error(d.error || "error"));
  } else if (d.type === "theme") {
    var r = document.documentElement.style;
    ["text", "bg", "dim", "field", "stroke"].forEach(function (k) {
      if (d[k]) r.setProperty("--" + k, d[k]);
    });
  }
});
/** データの読み書き(失敗しても、画面は止めない) */
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

// ==== 2. 小さな道具 ====
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

// ==== 3. 状態 ====
var note = "";

// ==== 4. 描画 ====
/** 状態を、画面へ反映する。 */
function render() {
  $("hello").textContent = note
    ? L("保存したメモ: ", "Saved note: ") + note
    : L("まだ何も保存していません", "Nothing saved yet");
  $("note").placeholder = L("ここに書いて、保存", "Type here and save");
  $("save").textContent = L("保存", "Save");
}

// ==== 5. 操作 ====
/** 入力した文字を保存する(保存したものは、次に開いたときにも残る)。 */
function save() {
  note = $("note").value.trim();
  store.set("note", note);
  call("toast", { message: L("保存しました", "Saved") }).catch(function () {});
  render();
}
$("save").onclick = save;
$("note").onkeydown = function (e) {
  e.stopPropagation();
  if (e.key === "Enter" && !e.isComposing) save();
};
// Esc で、ミニアプリを閉じる(入力中は閉じない)
addEventListener("keydown", function (e) {
  if (e.key === "Escape" && !(e.target && e.target.tagName === "INPUT")) call("close");
});

// ==== 6. 起動 ====
render();
store.get("note").then(function (v) {
  note = v || "";
  render();
});
