// ---- ランチャーとの窓口(postMessage) ----
var seq = 0,
  waiting = {};
/**
 * ランチャー(親の画面)へ、機能の呼び出しを送って、結果を待つ(postMessage の窓口)。60 秒で時間切れ。
 * @param method 機能の名前
 * @param params 渡す値
 * @returns 結果の約束
 */
function call(method, params) {
  return new Promise(function (resolve, reject) {
    var id = ++seq;
    waiting[id] = { resolve: resolve, reject: reject };
    parent.postMessage({ alumi: 1, id: id, method: method, params: params || {} }, "*");
    setTimeout(function () {
      if (waiting[id]) {
        delete waiting[id];
        reject(new Error("timeout"));
      }
    }, 60000);
  });
}
/**
 * 音楽プレーヤー(ランチャー本体が持つ)へ、操作の命令を送る。失敗しても何もしない。
 * @param c 命令の名前(`play` / `toggle` / `next` / `seek` など)
 * @param args 命令に付く値
 */
function cmd(c, args) {
  return call("player.cmd", { cmd: c, args: args || {} }).catch(function () {});
}
var ja = (navigator.language || "ja").toLowerCase().indexOf("ja") === 0;
var T = ja
  ? {
      none: "曲がありません",
      sub: "{n} 曲",
      favOn: "マイリストから外す",
      favOff: "マイリストに入れる",
      plnew: "新規",
      plren: "名前変更",
      pldel: "削除",
      plsure: "もう一度押すと削除",
      plname: "プレイリストの名前",
      ok: "OK",
      cancel: "キャンセル",
      copyTo: "「{n}」へコピー",
      add: "ファイルを追加",
      addDir: "フォルダを追加",
      clear: "クリア",
      empty: "「ファイルを追加」か「フォルダを追加」で、音楽を入れてください",
      speed: "速度",
      sleep: "おやすみ",
      off: "なし",
      min: "分",
      left: "あと",
    }
  : {
      none: "No tracks",
      sub: "{n} tracks",
      favOn: "Remove from My list",
      favOff: "Add to My list",
      plnew: "New",
      plren: "Rename",
      pldel: "Delete",
      plsure: "Press again to delete",
      plname: "Playlist name",
      ok: "OK",
      cancel: "Cancel",
      copyTo: 'Copy to "{n}"',
      add: "Add files",
      addDir: "Add folder",
      clear: "Clear",
      empty: 'Use "Add files" or "Add folder" to add music',
      speed: "Speed",
      sleep: "Sleep",
      off: "Off",
      min: "min",
      left: "left",
    };
var $ = function (id) {
  return document.getElementById(id);
};
$("addFiles").textContent = T.add;
$("addFolder").textContent = T.addDir;
$("clear").textContent = T.clear;
$("plnew").textContent = T.plnew;
$("plren").textContent = T.plren;
$("pldel").textContent = T.pldel;
$("plok").textContent = T.ok;
$("plcancel").textContent = T.cancel;
$("plname").placeholder = T.plname;
$("speedL").textContent = T.speed;
$("sleepL").textContent = T.sleep;
$("sleepOff").textContent = T.off;
[].forEach.call($("sleep").options, function (o) {
  if (o.value !== "0") o.textContent = o.value + " " + T.min;
});

var st = null,
  tracks = [],
  seeking = false,
  dragFrom = -1,
  listNames = null,
  editMode = null,
  delTimer = null;
