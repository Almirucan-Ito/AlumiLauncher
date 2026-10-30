/*
 * 電卓(ミニアプリ)の画面の動き。計算そのものは calc.js(Calc)。
 * 並び: 1. ランチャーとの窓口  2. 小さな道具  3. 状態  4. 描画  5. 操作  6. 起動
 * ・使うランチャーの機能は storage だけ(履歴の保存)。miniapp.json の permissions に書いてある
 * ・結果は、「=」を押したときだけ出す(式を打っている間は、いま打っている数を出す)
 */

/** 計算の部分(calc.js が、`window.Calc` に置く)。先に読み込まれている */
var Calc = window.Calc;

// ==== 1. ランチャーとの窓口(postMessage) ====
var seq = 0,
  waiting = {};
/**
 * ランチャー(親の画面)へ、機能の呼び出しを送って、結果を待つ。20 秒で時間切れ。
 * @param m 機能の名前(例: `storage.get` / `storage.set` / `close`)
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
    }, 20000);
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
    return call("storage.set", { key: k, value: String(v) }).catch(function () {});
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
/** 記号のキーの、読み上げ用の名前(日本語, 英語)。 */
var KEY_NAMES = {
  MC: ["メモリを消す", "Memory clear"],
  MR: ["メモリを呼び出す", "Memory recall"],
  "M+": ["メモリに足す", "Memory add"],
  "M-": ["メモリから引く", "Memory subtract"],
  "%": ["パーセント", "Percent"],
  "¦": ["余り", "Remainder (mod)"],
  "‖": ["商(整数の割り算)", "Quotient (integer division)"],
  "⌫": ["1 文字消す", "Backspace"],
  CE: ["いま打っている数を消す", "Clear entry"],
  C: ["全部消す", "Clear all"],
  "()": ["かっこ", "Parentheses"],
  "÷": ["割る", "Divide"],
  "×": ["掛ける", "Multiply"],
  "−": ["引く", "Subtract"],
  "+": ["足す", "Add"],
  "1/x": ["逆数", "Reciprocal"],
  "x²": ["2 乗", "Square"],
  "√": ["平方根", "Square root"],
  "±": ["プラスとマイナスを切り替える", "Negate"],
  "=": ["計算する", "Equals"],
};
/** 履歴に残す件数の上限。 */
var MAX_HISTORY = 20;

// ==== 3. 状態 ====
/** いまの式と、計算し終えた直後か(Calc.press が次の状態を決める) */
var st = { expr: "", done: false, error: "", mem: 0 };
/** 「=」で計算した履歴(新しいものが先頭)。注意: history という名前は、ブラウザの window.history と衝突するので使わない */
var calcHistory = [];
/** 「=」の直前の式(結果の上に、「式 =」と出すため) */
var lastExpr = "";

// ==== 4. 描画 ====
/** 文言(言語で変わるもの)を入れる。 */
function renderLabels() {
  document.documentElement.lang = JA ? "ja" : "en";
  document.title = L("電卓", "Calculator");
  $("hist-btn").textContent = L("履歴", "History");
  $("hist-title").textContent = L("履歴", "History");
  $("hist-clear").textContent = L("履歴を消す", "Clear history");
  $("hist-close").setAttribute("aria-label", L("閉じる", "Close"));
  $("pad").setAttribute("aria-label", L("電卓のキー", "Calculator keys"));
  [].forEach.call(document.querySelectorAll("#pad button[data-k]"), function (b) {
    var n = KEY_NAMES[b.dataset.k];
    if (n) b.setAttribute("aria-label", L(n[0], n[1]));
  });
}

/**
 * エラーの種類から、画面に出す文言を作る。
 * @param code `Calc.evaluate` のエラー(`div0` / `range` / `syntax`)
 */
function errorText(code) {
  if (code === "div0") return L("0 で割ることはできません", "Cannot divide by zero");
  if (code === "range") return L("大きすぎて計算できません", "The number is too large");
  if (code === "neg") return L("無効な入力です", "Invalid input");
  return L("式が正しくありません", "Invalid expression");
}

/** 式と結果を、画面に出す。 */
function render() {
  var line1 = Calc.show(st.expr),
    line2;
  if (st.error) {
    line2 = errorText(st.error);
  } else if (st.done) {
    line1 = Calc.show(lastExpr) + " =";
    line2 = st.expr;
  } else {
    // 途中の結果は出さない(結果は「=」を押したときだけ)。いま打っている数(演算子の直後は、その手前の数)を出す
    line2 = Calc.lastOperand(st.expr) || "0";
  }
  $("mem").hidden = !st.mem;
  $("mem").title = L("メモリ: ", "Memory: ") + Calc.format(st.mem || 0);
  $("line1").textContent = line1;
  var el = $("line2");
  el.textContent = line2;
  el.className = "line2" + (st.error ? " err" : "") + (line2.length > 16 ? " tiny" : line2.length > 10 ? " small" : "");
  // 長い式は、いちばん新しい(右の)ところが見えるようにする
  $("line1").scrollLeft = $("line1").scrollWidth;
}

/** 履歴の一覧を描き直す。 */
function renderHistory() {
  var box = $("hist-list");
  box.textContent = "";
  if (calcHistory.length === 0) {
    var none = document.createElement("div");
    none.className = "dim hist-none";
    none.textContent = L("まだ履歴がありません", "No history yet");
    box.appendChild(none);
  }
  calcHistory.forEach(function (h) {
    var b = document.createElement("button");
    b.className = "hist-row";
    b.title = L("結果を使う", "Use the result");
    var a = document.createElement("span");
    a.className = "dim";
    a.textContent = Calc.show(h.expr) + " =";
    var r = document.createElement("strong");
    r.textContent = h.text;
    b.appendChild(a);
    b.appendChild(r);
    b.onclick = function () {
      st = { expr: Calc.toExpr(h.text), done: true, error: "", mem: st.mem };
      lastExpr = h.expr;
      showHistory(false);
      render();
    };
    box.appendChild(b);
  });
}

/**
 * 履歴の画面を出す・隠す。
 * @param on 出すなら `true`
 */
function showHistory(on) {
  $("hist").hidden = !on;
  if (on) renderHistory();
}

// ==== 5. 操作 ====
/**
 * キーを 1 つ押したことにする(ボタン・キーボードの両方から呼ぶ)。
 * @param key `Calc.press` に渡すキー
 */
function press(key) {
  var prev = st.expr;
  var next = Calc.press(st, key);
  if (next.entry) {
    calcHistory.unshift(next.entry);
    calcHistory = calcHistory.slice(0, MAX_HISTORY);
    store.set("history", JSON.stringify(calcHistory));
    lastExpr = next.entry.expr;
  } else if (key === "=" && next.done && !next.entry) {
    lastExpr = prev;
  }
  st = { expr: next.expr, done: next.done, error: next.error, mem: next.mem };
  render();
}

// ボタン: data-k に、キーの名前が入っている
$("pad").addEventListener("click", function (e) {
  var b = e.target.closest("button[data-k]");
  if (!b) return;
  press(b.dataset.k);
  b.blur(); // ボタンにフォーカスが残ると、Enter や Space が、そのボタンも押してしまう
});
$("hist-btn").onclick = function () {
  showHistory($("hist").hidden);
  this.blur();
};
$("hist-close").onclick = function () {
  showHistory(false);
};
$("hist-clear").onclick = function () {
  calcHistory = [];
  store.set("history", "[]");
  renderHistory();
};

/** キーボードのキーを、電卓のキーに対応づける。 */
var KEYS = {
  "*": "×",
  x: "×",
  X: "×",
  "/": "÷",
  "-": "−",
  "+": "+",
  "%": "%",
  "(": "()",
  ")": "()",
  ".": ".",
  ",": ".",
  Enter: "=",
  "=": "=",
  Backspace: "⌫",
  Delete: "CE",
  m: "¦",
};
/** Ctrl + 文字 のメモリ操作(Windows の電卓と同じ)。 */
var CTRL_KEYS = { l: "MC", r: "MR", p: "M+", q: "M-" };
/** 直前に押した、キーボードのキー(「//」の判定用)。 */
var lastKey = "";
addEventListener("keydown", function (e) {
  if (e.ctrlKey && !e.metaKey && !e.altKey && CTRL_KEYS[e.key.toLowerCase()]) {
    e.preventDefault();
    press(CTRL_KEYS[e.key.toLowerCase()]);
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === "Escape") {
    // 履歴が開いていれば閉じる。式があれば消す。何もなければ、ミニアプリを閉じる
    if (!$("hist").hidden) showHistory(false);
    else if (st.expr) press("C");
    else call("close");
    return;
  }
  var key = Calc.isDigit(e.key) ? e.key : KEYS[e.key];
  if (!key) return;
  e.preventDefault();
  // 「/」を続けて 2 回押すと、商(//)にする
  if (e.key === "/" && lastKey === "/" && st.expr.slice(-1) === "÷") key = "‖";
  lastKey = e.key;
  press(key);
});

// ==== 6. 起動 ====
renderLabels();
render();
store.get("history").then(function (v) {
  try {
    var h = JSON.parse(v || "[]");
    if (Array.isArray(h))
      calcHistory = h
        .filter(function (x) {
          return x && typeof x.expr === "string" && typeof x.text === "string";
        })
        .slice(0, MAX_HISTORY);
  } catch (err) {
    calcHistory = [];
  }
});
