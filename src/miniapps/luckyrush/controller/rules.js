// ---- 仕組み(パチンコの「ST」と同じ考え方) ----
// 通常時: 1回転ごとに「抽選に入るか」を決め、入ったら色で当選期待度を見せる。当たると「チャンス」
// チャンス: 10回転の間に1回当たれば RUSH 確定
// RUSH   : 100回転を高速(約0.2秒)で回す。100回転の間に1回当たれば継続(また100回転から)。外れ切ったら終了
var COLORS = [
  { k: "white", n: "白", e: "White", w: 0.38, h: 0.02, c: "#f1f5f9" },
  { k: "blue", n: "青", e: "Blue", w: 0.26, h: 0.04, c: "#3b82f6" },
  { k: "orange", n: "橙", e: "Orange", w: 0.15, h: 0.1, c: "#f97316" },
  { k: "green", n: "緑", e: "Green", w: 0.1, h: 0.18, c: "#22c55e" },
  { k: "red", n: "赤", e: "Red", w: 0.07, h: 0.45, c: "#ef4444" },
  { k: "gold", n: "金", e: "Gold", w: 0.035, h: 0.8, c: "#ffd24a" },
  { k: "rainbow", n: "虹", e: "Rainbow", w: 0.005, h: 1.0, c: "#c084fc" },
];
var SUMWH = COLORS.reduce(function (a, c) {
  return a + c.w * c.h;
}, 0);
var RUSH_SPINS = 100,
  CHANCE_SPINS = 10;
var P_NORMAL = 1 / 25; // 通常時: 1回転あたりの当選確率
var P_CHANCE = 0.1; // チャンス中
var CONT_RATE = 0.9; // RUSH の継続率(100回転の間に1回以上当たる確率)
var P_RUSH = 1 - Math.pow(1 - CONT_RATE, 1 / RUSH_SPINS); // RUSH 中: 100回転で 90% になる 1回転あたりの確率(約 1/44)
var P_FREEZE = 0.0002; // フリーズ(0.02%)。遊び方・確率の説明には載せない
/**
 * 1 回転あたりの当選確率 `p` から、「抽選に入る」確率を求める。抽選に入ったあとの当たりやすさ(色ごとの期待度)の平均で割るので、「抽選に入る × 色ごとの当たり」の全体が、ちょうど `p` になる。
 * @param p 1 回転あたりの当選確率
 * @returns 抽選に入る確率(最大 1)
 */
function entryRate(p) {
  return Math.min(1, p / SUMWH);
}
/**
 * 1 回転ぶんの抽選をする。まず、フリーズ(通常時・チャンス中だけ、0.02%)かを決め、次に、抽選に入るかを決める。入ったら、色(白・青・橙・緑・赤・金・虹)を出やすさで選び、その色の期待度で、当たりか決める。
 * @param p 1 回転あたりの当選確率(通常時 / チャンス / RUSH で違う)
 * @returns `{ enter: 抽選に入ったか, color: 色の番号(-1 は抽選なし), hit: 当たりか, freeze: フリーズか }`
 */
function lottery(p) {
  var d = { enter: false, color: -1, hit: false };
  if (st.mode !== "rush" && Math.random() < P_FREEZE)
    return { enter: true, color: Math.floor(Math.random() * 6), hit: true, freeze: true }; // 色は虹以外
  if (Math.random() >= entryRate(p)) return d; // 抽選に入らない
  d.enter = true;
  var r = Math.random(),
    a = 0;
  for (var i = 0; i < COLORS.length; i++) {
    a += COLORS[i].w;
    if (r < a || i === COLORS.length - 1) {
      d.color = i;
      break;
    }
  }
  d.hit = Math.random() < COLORS[d.color].h;
  return d;
}
var SYMS = ["7", "1", "2", "3", "4", "5", "6", "9"];
var SCOL = {
  7: "#e11d48",
  1: "#1d4ed8",
  2: "#047857",
  3: "#b45309",
  4: "#7c3aed",
  5: "#0e7490",
  6: "#be185d",
  9: "#374151",
};
var st = {
  mode: "normal",
  chance: 0,
  remain: 0,
  chain: 0,
  busy: false,
  auto: false,
  turbo: false,
  sound: true,
  hi: 0,
  hist: [],
  rushes: 0,
  total: 0,
  sum: 0,
  since: 0,
  games: 0,
  vol: 0.7,
};
