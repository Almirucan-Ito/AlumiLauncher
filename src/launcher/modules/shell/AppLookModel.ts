import { type Settings } from "../../shared/api/ApiModel";
import { isLight } from "../../shared/lib/ColorUtil";
import { type PagerLayout } from "../../shared/ui/Pager";

/**
 * ホームの並べ方。ホーム(フォルダ一覧)とモーダル(フォルダを開いた状態)で、表示数のモードを別々に持つ。
 * 小さい表示(compact)のときは、アイコンの大きさと間隔を小さくして、少しでも多く並べる。
 * @param s 設定
 * @param compact 小さい表示か
 * @returns ホームと、フォルダを開いた画面の並べ方
 */
export function layoutsOf(s: Settings, compact: boolean): { home: PagerLayout; modal: PagerLayout } {
  const home: PagerLayout = {
    mode: s.homeLayoutMode,
    count: s.homeIconCount,
    size: compact ? Math.min(s.iconSize, 44) : s.iconSize,
    gap: compact ? Math.min(s.iconGap, 8) : s.iconGap,
    compact,
  };
  return { home, modal: { ...home, mode: s.modalLayoutMode, count: s.modalIconCount } };
}

/**
 * 画面の最上位の class 名(テーマ・小さい表示・最大化・デスクトップモード・ミニアプリ表示中・フォルダの後ろをぼかすか)。
 * @param s 設定
 * @param on 画面の状態
 */
export function appClassName(
  s: Settings,
  on: { compact: boolean; maximized: boolean; miniOpen: boolean; blurBehind: boolean },
): string {
  const light = s.theme === "custom" && isLight(s.customColor);
  const uiLight = s.uiTheme === "custom" && isLight(s.uiColor);
  return [
    "app",
    `theme-${s.theme}`,
    s.uiTheme !== "auto" && `ui ui-${s.uiTheme}`,
    uiLight && "ui-light",
    on.compact && "compact",
    light && "is-light",
    on.maximized && "maxed",
    s.desktopMode && "desktop-mode",
    on.miniOpen && "mini-on",
    on.blurBehind && s.modalBlur > 0 && "blur-behind",
  ]
    .filter(Boolean)
    .join(" ");
}
