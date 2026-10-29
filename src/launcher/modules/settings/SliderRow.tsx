import { useCallback, useEffect, useState } from "react";

/**
 * スライダー + キーボードで入力できる数値欄(範囲外は、自動で丸める)。
 * @param label 項目名
 * @param value 現在の値(保存する単位)
 * @param min 最小値(保存する単位)
 * @param max 最大値(保存する単位)
 * @param unit 単位の表示
 * @param onChange 値が変わったとき(保存する単位)
 * @param scale 保存する値 ÷ scale を画面に表示する(例: ミリ秒を秒で見せるなら 1000)
 * @param step 表示上の刻み(`scale` を使うとき 0.1 など)
 */
export function SliderRow({
  label,
  value,
  min,
  max,
  unit,
  onChange,
  scale = 1,
  step = 1,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (v: number) => void;
  /** 保存する値 ÷ scale を画面に表示する(例: ミリ秒の値を秒で見せるなら 1000) */
  scale?: number;
  /** 表示上の刻み(scale を使うとき 0.1 など) */
  step?: number;
}) {
  const shown = useCallback((v: number) => String(+(v / scale).toFixed(2)), [scale]);
  const [text, setText] = useState(shown(value));
  useEffect(() => setText(shown(value)), [value, shown]);

  const commit = () => {
    const n = Number(text);
    if (text.trim() === "" || !Number.isFinite(n)) return setText(shown(value));
    const v = Math.min(max, Math.max(min, Math.round(n * scale)));
    setText(shown(v));
    if (v !== value) onChange(v);
  };

  return (
    <div className="row">
      <span className="row-label">{label}</span>
      <input
        type="range"
        aria-label={label}
        min={min / scale}
        max={max / scale}
        step={step}
        value={value / scale}
        onChange={(e) => onChange(Math.round(Number(e.target.value) * scale))}
      />
      <input
        className="num"
        type="number"
        inputMode="decimal"
        min={min / scale}
        max={max / scale}
        step={step}
        value={text}
        aria-label={label}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit();
            e.currentTarget.blur();
          }
        }}
      />
      <span className="unit">{unit}</span>
    </div>
  );
}
