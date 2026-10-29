import { useState } from "react";
import { MIN_SIZE, type Settings } from "../../shared/api/ApiModel";
import { t } from "../../shared/i18n/i18n";
import { SIZE_PRESETS } from "./SettingsModel";

/**
 * 設定の「ウィンドウの大きさ」。よく使う大きさのボタンと、幅・高さの入力、いまの大きさを使うリンク。
 * @param settings 設定
 * @param onChange 設定が変わったとき
 * @param onApplySize ウィンドウの大きさを、実際に変えるとき
 */
export function SizeGroup({
  settings,
  onChange,
  onApplySize,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onApplySize: (w: number, h: number) => void;
}) {
  const [w, setW] = useState(String(settings.width));
  const [h, setH] = useState(String(settings.height));

  const apply = (width: number, height: number) => {
    const next = {
      ...settings,
      width: Math.max(MIN_SIZE.width, Math.round(width) || settings.width),
      height: Math.max(MIN_SIZE.height, Math.round(height) || settings.height),
    };
    setW(String(next.width));
    setH(String(next.height));
    onChange(next);
    onApplySize(next.width, next.height);
  };

  return (
    <div className="group">
      <div className="group-title">{t("sizeTitle")}</div>
      <div className="seg">
        {SIZE_PRESETS.map((p) => (
          <button
            key={p.label}
            className={settings.width === p.width && settings.height === p.height ? "on" : ""}
            onClick={() => apply(p.width, p.height)}
          >
            {t(p.label)}
            <small>
              {p.width}×{p.height}
            </small>
          </button>
        ))}
      </div>
      <div className="size-row">
        <input
          type="number"
          min={MIN_SIZE.width}
          value={w}
          onChange={(e) => setW(e.target.value)}
          aria-label={t("width")}
        />
        <span>×</span>
        <input
          type="number"
          min={MIN_SIZE.height}
          value={h}
          onChange={(e) => setH(e.target.value)}
          aria-label={t("height")}
        />
        <button className="small" onClick={() => apply(Number(w), Number(h))}>
          {t("apply")}
        </button>
      </div>
      <button
        className="link"
        onClick={() => {
          const nw = window.innerWidth;
          const nh = window.innerHeight;
          setW(String(nw));
          setH(String(nh));
          onChange({ ...settings, width: nw, height: nh });
        }}
      >
        {t("useCurrent")}
      </button>
      <div className="hint">{t("sizeHint", { w: MIN_SIZE.width, h: MIN_SIZE.height })}</div>
    </div>
  );
}
