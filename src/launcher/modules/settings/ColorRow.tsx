import { useEffect, useState } from "react";
import { t } from "../../shared/i18n/i18n";
import { normalizeHex } from "./SettingsModel";

/**
 * 設定の「好きな色」の 1 行。色の選択(色見本)と、色のコード(`#3b82f6`)を、キーボードで打てる入力欄を並べる。
 * ・6 桁そろった時点で反映する。3 桁(`f80`)や、`#` なしは、Enter か、欄を離れたときに反映する
 * ・読めない文字のまま欄を離れたら、元の色のコードに戻す(打っている途中は、赤い枠で知らせる)
 * @param value いまの色(`#rrggbb`)
 * @param onChange 色が決まったとき(`#rrggbb`)
 */
export function ColorRow({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [draft, setDraft] = useState(value);
  // 色見本などで色が変わったら、入力欄も合わせる
  useEffect(() => setDraft(value), [value]);

  const invalid = normalizeHex(draft) === null;

  /** 打った文字を、色として確定する(読めなければ、元に戻す)。 */
  const commit = (text: string) => {
    const hex = normalizeHex(text);
    if (hex === null) setDraft(value);
    else {
      setDraft(hex);
      if (hex !== value) onChange(hex);
    }
  };

  return (
    <div className="row">
      <span>{t("pickColor")}</span>
      <input type="color" aria-label={t("pickColor")} value={value} onChange={(e) => onChange(e.target.value)} />
      <input
        type="text"
        className={`hex${invalid ? " invalid" : ""}`}
        aria-label={t("colorCode")}
        aria-invalid={invalid}
        title={t("colorCode")}
        value={draft}
        maxLength={7}
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => {
          setDraft(e.target.value);
          // 6 桁そろったら、その場で反映する(3 桁は、途中かもしれないので、確定のときに)
          if (/^#?[0-9a-fA-F]{6}$/.test(e.target.value.trim())) commit(e.target.value);
        }}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit(e.currentTarget.value);
        }}
      />
    </div>
  );
}
