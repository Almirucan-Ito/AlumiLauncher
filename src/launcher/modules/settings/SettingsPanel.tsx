import { BackgroundGroup, ModalGroup, UiThemeGroup } from "./AppearanceGroups";
import { HotkeyRow } from "./HotkeyRow";
import { LayoutGroup } from "./LayoutGroup";
import { QuitButton } from "./QuitButton";
import { SizeGroup } from "./SizeGroup";
import { SliderRow } from "./SliderRow";
import {
  DRAG_DELAY_RANGE,
  ICON_GAP_RANGE,
  ICON_SIZE_RANGE,
  MERGE_DELAY_RANGE,
  PRESET_COUNT_RANGE,
  api,
  type Settings,
} from "../../shared/api/ApiModel";
import { t } from "../../shared/i18n/i18n";
import { useEffect, useState } from "react";

/**
 * 設定の画面(右下の歯車から開く)。ウィンドウの大きさ・表示数・アイコン・ヘッダー/フッター・ドラッグ・背景・UI の色・ショートカット・プリセット・音量・スタートアップ・「デフォルト値にする」・「アプリを終了する」など。
 * @param props `settings` 設定 / `hasImage` 背景画像があるか / `onChange` 設定が変わったとき / `onApplySize` 大きさを反映 / `onPickImage` 背景画像を選ぶ / `autostart`・`onAutostart` スタートアップ / `confirmReset`・`onReset` デフォルト値にする(2 回押し)/ `onHotkey` ショートカット / `onPresetsEnabled`・`onPresetCount` プリセット
 */
export function SettingsPanel({
  settings,
  hasImage,
  onChange,
  onApplySize,
  onPickImage,
  autostart,
  onAutostart,
  confirmReset,
  onReset,
  onHotkey,
  onPresetsEnabled,
  onPresetCount,
}: {
  settings: Settings;
  hasImage: boolean;
  /** 「デフォルト値にする」を一度押して、確認待ちの状態か */
  confirmReset: boolean;
  onReset: () => void;
  /** ショートカットの組み合わせを変える */
  onHotkey: (combo: string) => void;
  /** プリセットを使うかどうかを変える */
  onPresetsEnabled: (enabled: boolean) => void;
  /** プリセットの数を変える */
  onPresetCount: (count: number) => void;
  onChange: (s: Settings) => void;
  onApplySize: (w: number, h: number) => void;
  onPickImage: () => void;
  /** Windows 起動時に自動で起動するか(設定ファイルではなく、Windows のスタートアップ登録の状態) */
  autostart: boolean;
  onAutostart: (enabled: boolean) => void;
}) {
  const [version, setVersion] = useState("");
  useEffect(() => {
    api.getVersion().then((v) => setVersion(`v${v}`));
  }, []);

  return (
    <div className="settings" role="dialog" aria-label={t("settings")} onClick={(e) => e.stopPropagation()}>
      <h3>{t("settings")}</h3>

      <SizeGroup settings={settings} onChange={onChange} onApplySize={onApplySize} />

      <LayoutGroup
        title={t("homeLayoutTitle")}
        mode={settings.homeLayoutMode}
        count={settings.homeIconCount}
        onMode={(homeLayoutMode) => onChange({ ...settings, homeLayoutMode })}
        onCount={(homeIconCount) => onChange({ ...settings, homeIconCount })}
      />

      <LayoutGroup
        title={t("modalLayoutTitle")}
        mode={settings.modalLayoutMode}
        count={settings.modalIconCount}
        onMode={(modalLayoutMode) => onChange({ ...settings, modalLayoutMode })}
        onCount={(modalIconCount) => onChange({ ...settings, modalIconCount })}
      />

      <div className="group">
        <div className="group-title">{t("iconTitle")}</div>
        <SliderRow
          label={t("iconSize")}
          value={settings.iconSize}
          {...ICON_SIZE_RANGE}
          unit="px"
          onChange={(iconSize) => onChange({ ...settings, iconSize })}
        />
        <SliderRow
          label={t("iconGap")}
          value={settings.iconGap}
          {...ICON_GAP_RANGE}
          unit="px"
          onChange={(iconGap) => onChange({ ...settings, iconGap })}
        />
        <label className="check">
          <input
            type="checkbox"
            checked={settings.previewThumbnails}
            onChange={(e) => onChange({ ...settings, previewThumbnails: e.target.checked })}
          />
          <span>{t("previewToggle")}</span>
        </label>
      </div>

      <div className="group">
        <div className="group-title">{t("barsTitle")}</div>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.headerEnabled}
            onChange={(e) => onChange({ ...settings, headerEnabled: e.target.checked })}
          />
          <span>{t("headerToggle")}</span>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.footerEnabled}
            onChange={(e) => onChange({ ...settings, footerEnabled: e.target.checked })}
          />
          <span>{t("footerToggle")}</span>
        </label>
        <div className="hint">{t("barsHint")}</div>
      </div>

      <div className="group">
        <div className="group-title">{t("dragTitle")}</div>
        <SliderRow
          label={t("dragDelay")}
          value={settings.dragDelayMs}
          {...DRAG_DELAY_RANGE}
          scale={1000}
          step={0.1}
          unit={t("unitSec")}
          onChange={(dragDelayMs) => onChange({ ...settings, dragDelayMs })}
        />
        <SliderRow
          label={t("mergeDelay")}
          value={settings.mergeDelayMs}
          {...MERGE_DELAY_RANGE}
          scale={1000}
          step={0.1}
          unit={t("unitSec")}
          onChange={(mergeDelayMs) => onChange({ ...settings, mergeDelayMs })}
        />
        <div className="hint">{t("dragHint")}</div>
      </div>

      <BackgroundGroup settings={settings} onChange={onChange} hasImage={hasImage} onPickImage={onPickImage} />

      <UiThemeGroup settings={settings} onChange={onChange} />

      <ModalGroup settings={settings} onChange={onChange} />

      <div className="group">
        <div className="group-title">{t("presetTitle")}</div>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.presetsEnabled}
            onChange={(e) => onPresetsEnabled(e.target.checked)}
          />
          <span>{t("presetToggle")}</span>
        </label>
        {settings.presetsEnabled && (
          <SliderRow
            label={t("presetCount")}
            value={settings.presetCount}
            {...PRESET_COUNT_RANGE}
            unit=""
            onChange={onPresetCount}
          />
        )}
        <div className="hint">{t("presetHint")}</div>
      </div>

      {settings.networkAllowed.length > 0 && (
        <div className="group">
          <div className="group-title">{t("networkTitle")}</div>
          {settings.networkAllowed.map((k) => (
            <div className="row" key={k}>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                {k.replace(/^(widget|miniapp):/, "")}
              </span>
              <button
                className="small ghost-btn"
                onClick={() =>
                  onChange({ ...settings, networkAllowed: settings.networkAllowed.filter((x) => x !== k) })
                }
              >
                {t("networkRevoke")}
              </button>
            </div>
          ))}
          <div className="hint">{t("networkHint")}</div>
        </div>
      )}

      <div className="group">
        <div className="group-title">{t("volumeTitle")}</div>
        <SliderRow
          label={t("volumeAll")}
          value={settings.masterVolume}
          min={0}
          max={100}
          unit="%"
          onChange={(masterVolume) => onChange({ ...settings, masterVolume })}
        />
        <div className="hint">{t("volumeHint")}</div>
      </div>

      <div className="group">
        <div className="group-title">{t("windowTitle")}</div>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.showTooltips}
            onChange={(e) => onChange({ ...settings, showTooltips: e.target.checked })}
          />
          <span>{t("tooltipsToggle")}</span>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.alwaysOnTop && !settings.desktopMode}
            disabled={settings.desktopMode}
            onChange={(e) => onChange({ ...settings, alwaysOnTop: e.target.checked })}
          />
          <span>{t("alwaysOnTopToggle")}</span>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.desktopMode}
            onChange={(e) => onChange({ ...settings, desktopMode: e.target.checked })}
          />
          <span>{t("desktopModeToggle")}</span>
        </label>
        <div className="hint">{t("desktopModeHint")}</div>
      </div>

      <div className="group">
        <div className="group-title">{t("startupTitle")}</div>
        <label className="check">
          <input type="checkbox" checked={autostart} onChange={(e) => onAutostart(e.target.checked)} />
          <span>{t("startupToggle")}</span>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.startupShowWindow}
            onChange={(e) => onChange({ ...settings, startupShowWindow: e.target.checked })}
          />
          <span>{t("startupShowToggle")}</span>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.hotkeyEnabled}
            onChange={(e) => onChange({ ...settings, hotkeyEnabled: e.target.checked })}
          />
          <span>{t("hotkeyToggle")}</span>
        </label>
        <HotkeyRow value={settings.hotkey} enabled={settings.hotkeyEnabled} onChange={onHotkey} />
      </div>

      <button className={`reset${confirmReset ? " armed" : ""}`} onClick={onReset}>
        {confirmReset ? t("resetConfirm") : t("resetSettings")}
      </button>
      <QuitButton />
      <div className="hint settings-version">AlumiLauncher {version}</div>
    </div>
  );
}
