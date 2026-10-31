import { DIM_RANGE, MODAL_BLUR_RANGE, TRANSPARENCY_RANGE, type Settings, type Theme } from "../../shared/api/ApiModel";
import { t } from "../../shared/i18n/i18n";
import { ColorRow } from "./ColorRow";
import { THEMES, UI_THEMES } from "./SettingsModel";
import { SliderRow } from "./SliderRow";

/**
 * 設定の「背景」。背景の種類(色・画像)・好きな色・背景画像・背景の透明度。
 * @param settings 設定
 * @param onChange 設定が変わったとき
 * @param hasImage 背景画像を、すでに選んであるか(無ければ、「画像」を選んだとき、画像を選ぶ画面を出す)
 * @param onPickImage 背景画像を選ぶとき
 */
export function BackgroundGroup({
  settings,
  onChange,
  hasImage,
  onPickImage,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  hasImage: boolean;
  onPickImage: () => void;
}) {
  const pickTheme = (id: Theme) => {
    if (id === "image" && !hasImage) onPickImage();
    else onChange({ ...settings, theme: id });
  };

  return (
    <div className="group">
      <div className="group-title">{t("bgTitle")}</div>
      <div className="swatches">
        {THEMES.map((th) => (
          <button
            key={th.id}
            className={`swatch sw-${th.id}${settings.theme === th.id ? " on" : ""}`}
            style={th.id === "custom" ? { ["--chip" as string]: settings.customColor } : undefined}
            onClick={() => pickTheme(th.id)}
          >
            <span className="chip" />
            {t(th.label)}
          </button>
        ))}
      </div>

      {settings.theme === "custom" && (
        <ColorRow value={settings.customColor} onChange={(customColor) => onChange({ ...settings, customColor })} />
      )}

      {settings.theme === "image" && (
        <>
          <button className="link" onClick={onPickImage}>
            {t("changeImage")}
          </button>
          <SliderRow
            label={t("imageDim")}
            value={settings.imageDim}
            {...DIM_RANGE}
            unit="%"
            onChange={(imageDim) => onChange({ ...settings, imageDim })}
          />
        </>
      )}

      <SliderRow
        label={t("bgTransparency")}
        value={settings.bgTransparency}
        {...TRANSPARENCY_RANGE}
        unit="%"
        onChange={(bgTransparency) => onChange({ ...settings, bgTransparency })}
      />
    </div>
  );
}

/**
 * 設定の「UI の色」。ボタンなどの色・好きな色・透明度。
 * @param settings 設定
 * @param onChange 設定が変わったとき
 */
export function UiThemeGroup({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  return (
    <div className="group">
      <div className="group-title">{t("uiTitle")}</div>
      <div className="swatches">
        {UI_THEMES.map((th) => (
          <button
            key={th.id}
            className={`swatch sw-${th.id === "auto" ? "auto" : th.id}${settings.uiTheme === th.id ? " on" : ""}`}
            style={th.id === "custom" ? { ["--chip" as string]: settings.uiColor } : undefined}
            onClick={() => onChange({ ...settings, uiTheme: th.id })}
          >
            <span className="chip" />
            {t(th.label)}
          </button>
        ))}
      </div>
      {settings.uiTheme === "custom" && (
        <ColorRow value={settings.uiColor} onChange={(uiColor) => onChange({ ...settings, uiColor })} />
      )}
      <SliderRow
        label={t("uiTransparency")}
        value={settings.uiTransparency}
        {...TRANSPARENCY_RANGE}
        unit="%"
        onChange={(uiTransparency) => onChange({ ...settings, uiTransparency })}
      />
      <div className="hint">{t("uiHint")}</div>
    </div>
  );
}

/**
 * 設定の「フォルダ内の画面」。背景のぼかしと透明度。
 * @param settings 設定
 * @param onChange 設定が変わったとき
 */
export function ModalGroup({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  return (
    <div className="group">
      <div className="group-title">{t("modalTitle")}</div>
      <SliderRow
        label={t("modalBlur")}
        value={settings.modalBlur}
        {...MODAL_BLUR_RANGE}
        unit="px"
        onChange={(modalBlur) => onChange({ ...settings, modalBlur })}
      />
      <SliderRow
        label={t("modalTransparency")}
        value={settings.modalTransparency}
        {...TRANSPARENCY_RANGE}
        unit="%"
        onChange={(modalTransparency) => onChange({ ...settings, modalTransparency })}
      />
    </div>
  );
}
