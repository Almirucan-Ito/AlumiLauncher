import { t } from "../../shared/i18n/i18n";

/**
 * 左上の、プリセット(フォルダとアイコンの組み合わせ)の切り替えボタン(1 2 3 …)。
 * @param count プリセットの数
 * @param current いま表示しているプリセットの番号(1 から)
 * @param onSelect 別の番号を押したときに呼ぶ(いまの番号は押しても呼ばない)
 */
export function PresetSwitcher({
  count,
  current,
  onSelect,
}: {
  count: number;
  current: number;
  onSelect: (n: number) => void;
}) {
  return (
    <div className="presets" role="navigation" aria-label={t("presetTitle")}>
      {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          className={current === n ? "on" : ""}
          aria-label={t("presetLabel", { n })}
          title={t("presetLabel", { n })}
          onClick={() => current !== n && onSelect(n)}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
