// 電卓の計算(calc.js)のテスト。calc.js は、ブラウザ用のふつうのスクリプトなので、中身を読み込んで、CommonJS として動かす
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

/** 電卓の状態(`Calc.press` が受け取って返すもの)。 */
type State = { expr: string; done: boolean; error: string; mem?: number; entry?: { text: string } };
/** `calc.js` が出す関数(このテストで使うもの)。 */
interface CalcApi {
  evaluate(expr: string): { ok: boolean; text: string; error: string };
  close(expr: string): string;
  lastOperand(expr: string): string;
  show(expr: string): string;
  format(n: number): string;
  toExpr(text: string): string;
  press(state: State, key: string): State;
}

const mod = { exports: {} as unknown };
// テストは、リポジトリの直下で動かす(`npm test`)ので、そこからの道で読む
new Function("module", readFileSync(join(process.cwd(), "src/miniapps/calculator/controller/calc.js"), "utf8"))(mod);
const Calc = mod.exports as CalcApi;

/** 式を計算して、結果の文字列(失敗なら "ERR:<種類>")を返す。 */
const ev = (expr: string): string => {
  const r = Calc.evaluate(expr);
  return r.ok ? r.text : "ERR:" + r.error;
};
/** キーを順に押して、最後の状態を返す。 */
const keys = (seq: string | string[], st: State = { expr: "", done: false, error: "" }): State => {
  for (const k of Array.isArray(seq) ? seq : [...seq]) st = Calc.press(st, k);
  return st;
};

test("四則演算と、掛け算・割り算が先", () => {
  expect(ev("1+2×3")).toBe("7");
  expect(ev("10−4÷2")).toBe("8");
  expect(ev("2×3×4")).toBe("24");
  expect(ev("100÷4÷5")).toBe("5");
});

test("かっこ", () => {
  expect(ev("(1+2)×3")).toBe("9");
  expect(ev("2×(3+(4−1))")).toBe("12");
});

test("小数は、有効数字 12 桁に丸める(0.1+0.2 は 0.3)", () => {
  expect(ev("0.1+0.2")).toBe("0.3");
  expect(ev("10÷4")).toBe("2.5");
  expect(ev("1÷3")).toBe("0.333333333333");
  expect(ev("123456789×987654321"), "12 桁に丸める(実際は 121932631112635269)").toBe("121932631113000000");
});

test("負の数", () => {
  expect(ev("−5+3")).toBe("-2");
  expect(ev("2×(−3)")).toBe("-6");
  expect(ev("-5+3"), "ASCII のマイナスも使える").toBe("-2");
  expect(ev("5−(−3)")).toBe("8");
});

test("%(単独は 100 分の 1、足し算・引き算は、左の数の割合)", () => {
  expect(ev("50%")).toBe("0.5");
  expect(ev("200+10%")).toBe("220");
  expect(ev("200−10%")).toBe("180");
  expect(ev("200×10%")).toBe("20");
  expect(ev("200÷50%")).toBe("400");
});

test("0 で割る・式がおかしい・使えない文字", () => {
  expect(ev("1÷0")).toBe("ERR:div0");
  expect(ev("1÷(2−2)")).toBe("ERR:div0");
  expect(ev("1+")).toBe("ERR:syntax");
  expect(ev("(1+2")).toBe("ERR:syntax");
  expect(ev("1+2)")).toBe("ERR:syntax");
  expect(ev("")).toBe("ERR:syntax");
  expect(ev("1+a")).toBe("ERR:syntax");
  expect(ev("alert(1)"), "eval のような使い方はできない").toBe("ERR:syntax");
});

test("close: 終わりの演算子を捨て、かっこを閉じる", () => {
  expect(Calc.close("(1+2")).toBe("(1+2)");
  expect(Calc.close("12+")).toBe("12");
  expect(Calc.close("2×(3+")).toBe("2×(3)");
});

test("lastOperand: いま打っている数(演算子の直後は、その手前の数)", () => {
  expect(Calc.lastOperand("12")).toBe("12");
  expect(Calc.lastOperand("12+3")).toBe("3");
  expect(Calc.lastOperand("12+")).toBe("12");
  expect(Calc.lastOperand("")).toBe("");
});

test("余りと商(負の数は、小さい方へ丸める)", () => {
  expect(ev("7¦2")).toBe("1");
  expect(ev("7‖2")).toBe("3");
  expect(ev("−7¦3")).toBe("2");
  expect(ev("−7‖3")).toBe("-3");
  expect(ev("7 mod 2")).toBe("1");
  expect(ev("7//2")).toBe("3");
  expect(ev("7¦0")).toBe("ERR:div0");
  expect(ev("0.3‖0.1")).toBe("3");
  expect(Calc.show("7¦2‖1")).toBe("7 mod 2 // 1");
});

test("途中の結果は出さない: = を押すまで式のまま", () => {
  const s = keys("12+3");
  expect(s.expr).toBe("12+3");
  expect(s.done).toBe(false);
  expect(Calc.press(s, "=").expr).toBe("15");
});

test("√ x² 1/x: 式の終わりの数に、すぐ働く", () => {
  expect(keys(["9", "√"]).expr).toBe("3");
  expect(keys(["1", "+", "4", "x²"]).expr).toBe("1+16");
  expect(keys(["4", "1/x"]).expr).toBe("0.25");
  expect(keys(["2", "+", "9", "√", "="]).expr).toBe("5");
  expect(keys(["9", "=", "√"]).expr, "= の直後は結果に働く").toBe("3");
  expect(keys(["+", "√"]).expr, "数が無ければ何もしない").toBe("");
});

test("√ x² 1/x: エラー", () => {
  expect(keys(["5", "±", "√"]).error).toBe("neg");
  expect(keys(["0", "1/x"]).error).toBe("div0");
  expect(
    keys(["9", "9", "9", "9", "9", "9", "9", "9", "9", "9", "x²", "x²", "x²", "x²", "x²", "x²", "x²", "x²"]).error,
  ).toBe("range");
});

test("√ x² 1/x: 負の数にも働く", () => {
  expect(keys(["5", "±", "x²"]).expr).toBe("25");
  expect(keys(["4", "±", "1/x"]).expr).toBe("−0.25");
  expect(keys(["2", "+", "4", "±", "1/x"]).expr).toBe("2+(−0.25)");
  expect(keys(["2", "+", "3", "±", "x²", "="]).expr).toBe("11");
});

test("CE: いま打っている数だけを消す", () => {
  expect(keys(["1", "+", "2", "3", "CE"]).expr).toBe("1+");
  expect(keys(["1", "+", "2", "=", "CE"]).expr).toBe("");
});

test("メモリ: M+ M- MR MC", () => {
  let s = keys(["5", "M+"]);
  expect(s.mem).toBe(5);
  s = keys(["3", "M+"], { ...s, expr: "", done: false });
  expect(s.mem).toBe(8);
  s = keys(["2", "M-"], { ...s, expr: "", done: false });
  expect(s.mem).toBe(6);
  expect(keys(["MR"], { ...s, expr: "", done: false }).expr).toBe("6");
  expect(keys(["1", "+", "MR", "="], { ...s, expr: "", done: false }).expr).toBe("7");
  expect(keys(["MC"], s).mem).toBe(0);
  const t = keys(["1", "+", "2", "=", "M+"]);
  expect(t.mem, "= の直後は結果を足す").toBe(3);
  expect(t.done).toBe(true);
  expect(keys(["+", "M+"]).mem, "数が無ければ何もしない").toBe(0);
  const neg = keys(["MR"], { expr: "2+", done: false, error: "", mem: -3 });
  expect(neg.expr, "負の数は、かっこで包む").toBe("2+(−3)");
});

test("キー: 数字と小数点", () => {
  expect(keys("123").expr).toBe("123");
  expect(keys("007").expr, "0 の次の数字は置き換える").toBe("7");
  expect(keys("1.5.2").expr, "小数点は、1 つの数に 1 回だけ").toBe("1.52");
  expect(keys(".5").expr).toBe("0.5");
  expect(keys("1+.").expr).toBe("1+0.");
});

test("キー: 演算子", () => {
  expect(keys("5+3").expr).toBe("5+3");
  expect(keys(["5", "+", "×"]).expr, "演算子の押し直しは置き換える").toBe("5×");
  expect(keys(["×"]).expr, "式が空のとき、− 以外の演算子は無視する").toBe("");
  expect(keys(["−", "5"]).expr).toBe("−5");
});

test("キー: = で計算し、続けて演算子を押すと、結果から続ける", () => {
  const a = keys(["1", "2", "+", "3", "="]);
  expect([a.expr, a.done, a.entry && a.entry.text]).toEqual(["15", true, "15"]);
  const b = Calc.press(a, "×");
  expect(b.expr).toBe("15×");
  expect(keys(["2", "="], b).expr).toBe("30");
});

test("キー: 計算したあとに数字を押すと、新しい計算", () => {
  const a = keys(["1", "+", "2", "="]);
  expect(Calc.press(a, "7").expr).toBe("7");
  expect(Calc.press(a, "()").expr).toBe("(");
});

test("キー: 終わりの演算子・かっこがあっても = で計算できる", () => {
  expect(keys(["8", "÷", "2", "+", "="]).expr).toBe("4");
  expect(keys(["2", "()", "3", "+", "4", "="]).expr, "2(3+4) は 2×(3+4)").toBe("14");
});

test("キー: 0 で割ると、エラー(式は残す)", () => {
  const s = keys(["1", "÷", "0", "="]);
  expect(s.error).toBe("div0");
  expect(s.expr).toBe("1÷0");
  expect(s.done).toBe(false);
  expect(Calc.press(s, "⌫").error, "次のキーで、エラーは消える").toBe("");
});

test("キー: %", () => {
  expect(keys(["2", "0", "0", "+", "1", "0", "%", "="]).expr).toBe("220");
  expect(keys(["%"]).expr, "数のあとだけ").toBe("");
});

test("キー: かっこ", () => {
  expect(keys(["()", "1", "+", "2", "()"]).expr).toBe("(1+2)");
  expect(keys(["3", "()"]).expr).toBe("3×(");
});

test("キー: ±", () => {
  expect(keys(["5", "±"]).expr).toBe("−5");
  expect(keys(["5", "±", "±"]).expr).toBe("5");
  expect(keys(["2", "+", "5", "±"]).expr).toBe("2+(−5)");
  expect(keys(["2", "+", "5", "±", "±"]).expr).toBe("2+5");
  expect(keys(["2", "+", "5", "±", "="]).expr).toBe("−3");
});

test("キー: ⌫ と C", () => {
  expect(keys(["1", "2", "3", "⌫"]).expr).toBe("12");
  expect(keys(["1", "+", "2", "="]).done).toBe(true);
  expect(keys(["1", "+", "2", "=", "⌫"]).expr, "計算し終えたあとの ⌫ は、全部消す").toBe("");
  expect(keys(["1", "+", "2", "C"]).expr).toBe("");
});

test("結果は、指数表記にしない(続けて計算できるように)", () => {
  expect(Calc.format(1e21)).toBe("1000000000000000000000");
  expect(Calc.format(0.0000001)).toBe("0.0000001");
  expect(Calc.format(-0)).toBe("0");
});

test("結果の先頭のマイナスは、式の中では − になる", () => {
  expect(Calc.toExpr("-5")).toBe("−5");
  expect(keys(["2", "−", "5", "="]).expr).toBe("−3");
  expect(keys(["2", "−", "5", "=", "+", "1", "="]).expr).toBe("−2");
});
