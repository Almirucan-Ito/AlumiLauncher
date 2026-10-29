/**
 * ランチャー(親の画面)へ、機能の呼び出しを送って、結果を待つ(postMessage の窓口)。見本なので、時間切れは扱わない。
 * @param m 機能の名前(例: `toast`)
 * @param p 渡す値
 * @returns 結果の約束
 */
var seq = 0,
  w = {};
function call(m, p) {
  return new Promise(function (res, rej) {
    var id = ++seq;
    w[id] = { res: res, rej: rej };
    parent.postMessage({ alumi: 1, id: id, method: m, params: p || {} }, "*");
  });
}
addEventListener("message", function (e) {
  var d = e.data;
  if (d && d.alumi === 1 && d.id && w[d.id]) {
    var x = w[d.id];
    delete w[d.id];
    d.ok ? x.res(d.result) : x.rej(new Error(d.error));
  }
});
var n = 0,
  el = document.getElementById("n");
call("storage.get", { key: "n" }).then(function (v) {
  n = Number(v) || 0;
  el.textContent = n;
});
document.getElementById("b").onclick = function () {
  n++;
  el.textContent = n;
  call("storage.set", { key: "n", value: String(n) });
};
