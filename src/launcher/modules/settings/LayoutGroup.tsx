import { SliderRow } from "./SliderRow";
import { ICON_COUNT_RANGE } from "../../shared/api/ApiModel";
import { t } from "../../shared/i18n/i18n";

/**
 * 表示数のモード切り替え(画面に合わせる / 個数を指定)と、個数のスライダー。
 * @param title 見出し
 * @param mode いまのモード
 * @param count 個数
 * @param onMode モードが変わったとき
 * @param onCount 個数が変わったとき
 */
export function LayoutGroup({
  title,
  mode,
  count,
  onMode,
  onCount,
}: {
  title: string;
  mode: "auto" | "fixed";
  count: number;
  onMode: (m: "auto" | "fixed") => void;
  onCount: (n: number) => void;
}) {
  return (
    <div className="group">
      <div className="group-title">{title}</div>
      <div className="seg two">
        {(
          [
            ["auto", "layoutAuto"],
            ["fixed", "layoutFixed"],
          ] as const
        ).map(([v, label]) => (
          <button key={v} className={mode === v ? "on" : ""} onClick={() => onMode(v)}>
            {t(label)}
          </button>
        ))}
      </div>
      {mode === "fixed" && (
        <SliderRow label={t("iconCount")} value={count} {...ICON_COUNT_RANGE} unit="" onChange={onCount} />
      )}
    </div>
  );
}
