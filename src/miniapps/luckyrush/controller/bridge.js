// ---- ランチャーとの窓口 ----
var seq = 0,
  waiting = {};
/**
 * ランチャー(親の画面)へ、機能の呼び出しを送って、結果を待つ(postMessage の窓口)。20 秒で時間切れ。
 * @param m 機能の名前(`storage.get` / `storage.set` / `close`)
 * @param p 渡す値
 * @returns 結果の約束
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
    }, 20000);
  });
}
addEventListener("message", function (e) {
  var d = e.data;
  if (!d || d.alumi !== 1) return;
  if (d.id && waiting[d.id]) {
    var w = waiting[d.id];
    delete waiting[d.id];
    d.ok ? w.res(d.result) : w.rej(new Error(d.error || "error"));
  }
});
var store = {
  get: function (k) {
    return call("storage.get", { key: k }).catch(function () {
      return null;
    });
  },
  set: function (k, v) {
    return call("storage.set", { key: k, value: String(v) }).catch(function () {});
  },
};
/** ID から要素を取る。 */
function $(i) {
  return document.getElementById(i);
}
/** 表示言語が、日本語か。 */
var JA = (navigator.language || "ja").toLowerCase().indexOf("ja") === 0;
/**
 * 表示言語に合わせて、文言を選ぶ。
 * @param ja 日本語のとき
 * @param en それ以外のとき
 */
function L(ja, en) {
  return JA ? ja : en;
}
