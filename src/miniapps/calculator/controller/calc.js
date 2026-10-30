/*
 * 電卓の計算(画面に依存しない部分)。式は文字列で、数字・小数点・+ − × ÷ ・余り(¦)・商(‖)・% ・ ( ) が使える。
 * 画面(main.js)は、ここの関数を呼ぶだけ。ブラウザでは Calc というグローバルな名前、Node.js では require で読める(テスト用)。
 *
 * 結果は、「=」を押したときだけ出す(途中の結果は出さない)。
 *
 * % の考え方(スマートフォンの電卓と同じ):
 *   ・単独の 50%     → 0.5
 *   ・200 + 10%      → 200 に、その 10% を足す(220)。引き算も同じ(200 − 10% = 180)
 *   ・200 × 10%      → 200 × 0.1(20)
 *
 * 余りと商(割り算。0 で割るとエラー。負の数は、Python と同じ「小さい方へ丸める」考え方):
 *   ・7 mod 2  → 1(7 ÷ 2 の余り)   ・7 // 2 → 3(7 ÷ 2 の商の整数部分)   ・−7 mod 3 → 2、−7 // 3 → −3
 *   ・式の中では、余りを「¦」、商を「‖」で持つ(1 文字の演算子として扱うため)。画面には、「mod」「//」と出す(`show`)。
 *
 * 1 つの数に、すぐ働くキー(√ x² 1/x): 式の終わりの数(「=」の直後なら結果)に、すぐ働く。
 * メモリ(MC MR M+ M−): 画面に出ている数(「=」の直後なら結果、式を打っている途中なら、いちばん新しい数)を、足し引きする。
 */
(function (root) {
  var OPS = "+−×÷¦‖";
  /** 有効数字(これを超える桁は丸める。0.1 + 0.2 が 0.30000000000000004 にならないように) */
  var DIGITS = 12;
  /** 式の中の 1 文字の演算子を、画面に出す形にする対応(余りと商は、読みやすいよう、前後に空白を入れる) */
  var SHOWN = { "¦": " mod ", "‖": " // " };

  /**
   * 文字が演算子(+ − × ÷ ¦ ‖)か。
   * @param c 1 文字
   */
  function isOp(c) {
    return c !== "" && OPS.indexOf(c) >= 0;
  }
  /**
   * 文字が数字(0〜9)か。
   * @param c 1 文字
   */
  function isDigit(c) {
    return c >= "0" && c <= "9" && c.length === 1;
  }
  /**
   * 式の終わりにある数(`12.5` など)を返す。数で終わっていなければ空。
   * @param expr 式
   */
  function lastNumber(expr) {
    var m = /(\d*\.?\d*)$/.exec(expr);
    return m ? m[1] : "";
  }
  /**
   * 式の中の、いちばん新しい(右の)数を返す(演算子で終わっていても、その手前の数)。無ければ空。
   * @param expr 式
   */
  function lastOperand(expr) {
    var re = /\d+\.?\d*|\.\d+/g,
      m,
      last = "";
    while ((m = re.exec(expr))) last = m[0];
    return last;
  }
  /**
   * 開いたままの「(」の数。
   * @param expr 式
   */
  function openCount(expr) {
    var n = 0;
    for (var i = 0; i < expr.length; i++) {
      if (expr.charAt(i) === "(") n++;
      else if (expr.charAt(i) === ")") n--;
    }
    return n;
  }
  /**
   * 式を、画面に出す形にする(余り・商の記号を、「mod」「//」にする)。
   * @param expr 式
   */
  function show(expr) {
    return expr.replace(/[¦‖]/g, function (c) {
      return SHOWN[c];
    });
  }

  /**
   * 式を、計算できる形にする: 終わりの演算子・「(」を捨て、開いたままの「(」を閉じる。
   * @param expr 式
   * @returns 整えた式
   */
  function close(expr) {
    var s = expr;
    while (s.length && (isOp(s.charAt(s.length - 1)) || s.charAt(s.length - 1) === "(")) s = s.slice(0, -1);
    for (var n = openCount(s); n > 0; n--) s += ")";
    return s;
  }

  /**
   * 式を、字句(数・演算子・かっこ・%)に分ける。
   * @param expr 式(`−` `×` `÷` のほか、`-` `*` `/` `x`、余りの `mod`、商の `//` も使える)
   * @returns 字句の配列。使えない文字があれば `null`
   */
  function tokenize(expr) {
    var s = expr
      .replace(/\/\//g, "‖")
      .replace(/mod/gi, "¦")
      .replace(/−/g, "-")
      .replace(/[×xX*]/g, "*")
      .replace(/÷/g, "/")
      .replace(/\s+/g, "");
    var out = [],
      i = 0;
    while (i < s.length) {
      var rest = s.slice(i);
      var m = /^(\d+\.?\d*|\.\d+)/.exec(rest);
      if (m) {
        out.push({ t: "num", v: parseFloat(m[1]) });
        i += m[1].length;
      } else if (s.charAt(i) === "¦") {
        out.push({ t: "mod" });
        i++;
      } else if (s.charAt(i) === "‖") {
        out.push({ t: "idiv" });
        i++;
      } else if ("+-*/()%".indexOf(s.charAt(i)) >= 0) {
        out.push({ t: s.charAt(i) });
        i++;
      } else return null;
    }
    return out;
  }

  /**
   * 割り算の商を、小さい方へ丸めた整数にする。浮動小数点の誤差(0.3 ÷ 0.1 が 2.9999999999999996 になるなど)で、
   * 本当は割り切れるものが、1 小さくならないよう、整数にとても近いときは、その整数にする。
   * @param a 割られる数
   * @param b 割る数(0 でない)
   */
  function floorDiv(a, b) {
    var q = a / b;
    var r = Math.round(q);
    return Math.abs(q - r) < 1e-9 * Math.max(1, Math.abs(q)) ? r : Math.floor(q);
  }

  /**
   * 式を計算する(字句を順に読む再帰下降の構文解析。eval は使わない)。
   * @param expr 式
   * @returns `{ ok: true, value, text }` か、`{ ok: false, error }`(`syntax` 式がおかしい / `div0` 0 で割った / `range` 大きすぎる)
   */
  function evaluate(expr) {
    var tk = tokenize(expr);
    if (!tk || tk.length === 0) return { ok: false, error: "syntax" };
    var p = 0;
    function peek() {
      return tk[p] ? tk[p].t : "";
    }
    function fail(code) {
      var e = new Error(code);
      e.code = code;
      throw e;
    }
    // 値は { v: 数, pct: 「数%」だけの項か }
    function primary() {
      var x = tk[p];
      if (!x) fail("syntax");
      if (x.t === "num") {
        p++;
        return { v: x.v, pct: false };
      }
      if (x.t === "(") {
        p++;
        var r = additive();
        if (peek() !== ")") fail("syntax");
        p++;
        return { v: r.v, pct: false };
      }
      return fail("syntax");
    }
    function postfix() {
      var r = primary();
      while (peek() === "%") {
        p++;
        r = { v: r.v / 100, pct: true };
      }
      return r;
    }
    function unary() {
      if (peek() === "-") {
        p++;
        var r = unary();
        return { v: -r.v, pct: false };
      }
      if (peek() === "+") {
        p++;
        return unary();
      }
      return postfix();
    }
    function multiplicative() {
      var r = unary();
      while (peek() === "*" || peek() === "/" || peek() === "mod" || peek() === "idiv") {
        var op = tk[p++].t;
        var b = unary();
        if (op !== "*" && b.v === 0) fail("div0");
        var v;
        if (op === "*") v = r.v * b.v;
        else if (op === "/") v = r.v / b.v;
        else if (op === "idiv") v = floorDiv(r.v, b.v);
        else v = r.v - b.v * floorDiv(r.v, b.v); // 余り(割る数と同じ符号)
        r = { v: v, pct: false };
      }
      return r;
    }
    function additive() {
      var r = multiplicative();
      while (peek() === "+" || peek() === "-") {
        var op = tk[p++].t;
        var b = multiplicative();
        // 「200 + 10%」は、200 の 10% を足す(右が「数%」だけのときだけ)
        var rhs = b.pct ? r.v * b.v : b.v;
        r = { v: op === "+" ? r.v + rhs : r.v - rhs, pct: false };
      }
      return r;
    }
    try {
      var res = additive();
      if (p !== tk.length) return { ok: false, error: "syntax" };
      if (!isFinite(res.v)) return { ok: false, error: "range" };
      return { ok: true, value: res.v, text: format(res.v) };
    } catch (e) {
      return { ok: false, error: e.code || "syntax" };
    }
  }

  /**
   * 数を、表示用の文字列にする(有効数字 12 桁に丸めて、指数表記にしない。負の数の符号は `-`)。
   * @param n 数
   */
  function format(n) {
    var r = Number(n.toPrecision(DIGITS));
    if (r === 0) return "0";
    var s = String(r);
    if (/e/i.test(s)) s = r.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 20 });
    return s;
  }

  /**
   * 結果の文字列を、式に入れる形にする(先頭のマイナスは `−`)。
   * @param text `format` の結果
   */
  function toExpr(text) {
    return text.replace(/^-/, "−");
  }

  /**
   * 1 つの数にすぐ働くキー(√ x² 1/x)の計算。
   * @param key `√` `x²` `1/x`
   * @param v 数
   * @returns `{ v }` か、`{ error }`(`neg` 負の数の平方根 / `div0` 0 の逆数 / `range` 大きすぎる)
   */
  function unaryOp(key, v) {
    var r;
    if (key === "√") {
      if (v < 0) return { error: "neg" };
      r = Math.sqrt(v);
    } else if (key === "x²") r = v * v;
    else {
      if (v === 0) return { error: "div0" };
      r = 1 / v;
    }
    return isFinite(r) ? { v: r } : { error: "range" };
  }

  /**
   * いま画面に出ている数(メモリに足し引きする数)。「=」の直後なら結果、そうでなければ、式のいちばん新しい数。
   * @param expr 式
   * @param done 「=」で計算し終えた直後か
   * @returns 数。無ければ `null`
   */
  function displayValue(expr, done) {
    if (done) {
      var r = evaluate(close(expr));
      return r.ok ? r.value : null;
    }
    var n = lastOperand(expr);
    return n === "" ? null : parseFloat(n);
  }

  /**
   * キー(ボタン・キーボード)を 1 つ押したときの、次の状態を求める。
   * @param st いまの状態 `{ expr, done, mem }`(`done` は、「=」で計算し終えた直後か。`mem` はメモリの数)
   * @param key `0`〜`9` `.` `+` `−` `×` `÷` `¦`(余り) `‖`(商) `%` `()` `±` `⌫` `CE` `C` `√` `x²` `1/x` `MC` `MR` `M+` `M-` `=`
   * @returns 次の状態 `{ expr, done, error, entry, mem }`(`entry` は、「=」で計算できたときの履歴の 1 件 `{ expr, text }`)
   */
  function press(st, key) {
    var done = !!st.done;
    var expr = st.expr || "";
    var mem = st.mem || 0;
    var out = { expr: expr, done: false, error: "", entry: null, mem: mem };
    // 計算し終えた直後に、数・小数点・かっこを押したら、新しい計算を始める(演算子・%・± は、結果から続ける)
    var fresh = done && (isDigit(key) || key === "." || key === "()");
    if (fresh) expr = "";
    var last = expr.charAt(expr.length - 1);
    var num = lastNumber(expr);

    if (isDigit(key)) {
      if (num === "0")
        expr = expr.slice(0, -1); // 0 の次の数字は、0 を置き換える(007 にならない)
      else if (last === ")" || last === "%") expr += "×"; // 「(1+2)3」は「(1+2)×3」
      out.expr = expr + key;
    } else if (key === ".") {
      if (num.indexOf(".") >= 0) out.expr = expr;
      else if (isDigit(last)) out.expr = expr + ".";
      else out.expr = expr + (last === ")" || last === "%" ? "×0." : "0.");
    } else if (isOp(key)) {
      if (expr === "") out.expr = key === "−" ? "−" : "";
      else if (last === "(") out.expr = key === "−" ? expr + "−" : expr;
      else if (isOp(last))
        out.expr = expr.length === 1 ? expr : expr.slice(0, -1) + key; // 演算子の押し直しは、置き換える
      else out.expr = expr + key;
      out.done = false;
    } else if (key === "%") {
      out.expr = isDigit(last) || last === ")" || last === "%" ? expr + "%" : expr;
    } else if (key === "()") {
      var canClose = openCount(expr) > 0 && (isDigit(last) || last === ")" || last === "%");
      if (canClose) out.expr = expr + ")";
      else if (isDigit(last) || last === ")" || last === "%") out.expr = expr + "×(";
      else out.expr = expr + "(";
    } else if (key === "±") {
      var wrapped = /\(−(\d*\.?\d*)\)$/.exec(expr);
      if (expr === "") out.expr = "−";
      else if (wrapped) out.expr = expr.slice(0, expr.length - wrapped[0].length) + wrapped[1];
      else if (num !== "") {
        var before = expr.slice(0, expr.length - num.length);
        // 式の先頭の数なら、先頭に − を付け外しする。それ以外は (−数) で包む
        out.expr = before === "" ? "−" + num : before === "−" ? num : before + "(−" + num + ")";
      } else if (/^−\d/.test(expr) && !isOp(last)) out.expr = expr.slice(1);
      else out.expr = expr;
      out.done = done;
    } else if (key === "⌫") {
      out.expr = done ? "" : expr.slice(0, -1);
    } else if (key === "CE") {
      // いま打っている数だけを消す(「=」の直後は、結果を消す)
      out.expr = done ? "" : expr.slice(0, expr.length - num.length);
    } else if (key === "C") {
      out.expr = "";
    } else if (key === "√" || key === "x²" || key === "1/x") {
      // 式の終わりの数(「=」の直後は、結果)に、すぐ働く。終わりが数でなければ、何もしない
      // 負の数は、「(−数)」か、式の先頭の「−数」の形になっている
      var neg = /\(−\d*\.?\d*\)$/.exec(expr);
      var tail = neg ? neg[0] : expr === "−" + num && num !== "" ? expr : num;
      var target = done
        ? displayValue(expr, true)
        : tail === ""
          ? null
          : parseFloat(tail.replace(/[()−]/g, "")) * (neg || tail !== num ? -1 : 1);
      out.expr = expr;
      out.done = done;
      if (target !== null) {
        var u = unaryOp(key, target);
        if (u.error) out.error = u.error;
        else {
          var text = format(u.v);
          var shown = u.v < 0 && !done && expr !== "−" + num ? "(" + toExpr(text) + ")" : toExpr(text);
          out.expr = done ? toExpr(text) : expr.slice(0, expr.length - tail.length) + shown;
        }
      }
    } else if (key === "MC") {
      out.mem = 0;
      out.expr = expr;
      out.done = done;
    } else if (key === "M+" || key === "M-") {
      var dv = displayValue(expr, done);
      if (dv !== null) out.mem = Number((mem + (key === "M+" ? dv : -dv)).toPrecision(DIGITS));
      out.expr = expr;
      out.done = done;
    } else if (key === "MR") {
      var mt = format(mem);
      var inner = mem < 0 ? "(" + toExpr(mt) + ")" : mt; // 式の途中の負の数は、かっこで包む
      if (done || expr === "") out.expr = toExpr(mt);
      else if (isDigit(last) || last === ".") out.expr = expr.slice(0, expr.length - num.length) + inner;
      else if (last === ")" || last === "%") out.expr = expr + "×" + inner;
      else out.expr = expr + inner;
    } else if (key === "=") {
      var closed = close(expr);
      if (closed === "") {
        out.expr = expr;
        out.done = done;
        return out;
      }
      var r = evaluate(closed);
      if (!r.ok) {
        out.expr = expr;
        out.error = r.error;
        return out;
      }
      out.expr = toExpr(r.text);
      out.done = true;
      if (closed !== r.text) out.entry = { expr: closed, text: r.text };
    }
    return out;
  }

  var api = {
    OPS: OPS,
    isOp: isOp,
    isDigit: isDigit,
    lastNumber: lastNumber,
    lastOperand: lastOperand,
    openCount: openCount,
    show: show,
    close: close,
    tokenize: tokenize,
    evaluate: evaluate,
    format: format,
    toExpr: toExpr,
    displayValue: displayValue,
    press: press,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Calc = api;
})(typeof window !== "undefined" ? window : this);
