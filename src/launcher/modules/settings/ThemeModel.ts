import { type Settings } from "../../shared/api/ApiModel";

/**
 * テーマ・UI の色・透過度・アイコンの大きさ・ぼかしなどを、CSS の変数にして、画面の最上位に渡す。
 *
 * @param settings 設定
 * @param accent Windows のテーマカラー
 * @param iconSize アイコンの大きさ(px。小さい表示のときは、設定より小さくなる)
 * @param iconGap アイコンの間隔(px。同上)
 * @param bgImage 背景画像(表示用の URL。無ければ `null`)
 * @returns CSS の変数名 → 値
 */
export function themeVarsOf(
  settings: Settings,
  accent: string,
  iconSize: number,
  iconGap: number,
  bgImage: string | null,
): Record<string, string> {
  const vars: Record<string, string> = {
    "--accent": settings.theme === "custom" ? settings.customColor : accent,
    // UI の色: 「好きな色」はその色、「Windows テーマ」は Windows の色(「背景と同じ」のときは使わない)
    "--ui-accent": settings.uiTheme === "custom" ? settings.uiColor : accent,
    "--ui-alpha": `${100 - settings.uiTransparency}%`,
    // 設定画面の「Windows テーマ」の見本は、「好きな色」を選んでも Windows の色のままにする
    "--sys-accent": accent,
    "--dim": String(settings.imageDim / 100),
    "--icon-size": `${iconSize}px`,
    "--icon-gap": `${iconGap}px`,
    "--bg-opacity": String(1 - settings.bgTransparency / 100),
    "--sheet-opacity": String(1 - settings.modalTransparency / 100),
    "--modal-blur": `${settings.modalBlur}px`,
  };
  if (bgImage) vars["--bgimg"] = `url("${bgImage}")`;
  return vars;
}
