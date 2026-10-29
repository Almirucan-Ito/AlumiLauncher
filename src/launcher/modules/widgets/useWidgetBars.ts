import { useState } from "react";
import { type ModWidget, type Settings } from "../../shared/api/ApiModel";
import { t } from "../../shared/i18n/i18n";
import { type MenuAction } from "../../shared/ui/MenuModel";
import {
  COLS,
  ROWS_LARGE,
  ROWS_SMALL,
  ROWS_STANDARD,
  cellsWith,
  placeNear,
  resizeTo,
  resolveLayout,
  rowsFor,
  ruleFor,
  type Placement,
} from "./LayoutModel";
import { locateInBars, type BarId, type DropPreview } from "./WidgetBar";
import { widgetName } from "./WidgetPicker";

/**
 * ヘッダー・フッターのウィジェットの置き場所・追加・移動・大きさ・右クリックメニュー(置き場所の計算は `LayoutModel.ts`)。
 * @param settings 設定
 * @param mods ウィジェットの一覧
 * @param changeSettings 設定を変えて保存する関数
 * @param flash 画面に一言出す関数
 * @param showMenu 右クリックメニューを出す関数
 * @returns 欄の描画・追加画面・メニューから使う関数と、動かしている間の状態
 */
export function useWidgetBars({
  settings,
  mods,
  changeSettings,
  flash,
  showMenu,
}: {
  settings: Settings;
  mods: ModWidget[];
  changeSettings: (s: Settings) => void;
  flash: (msg: string) => void;
  showMenu: (x: number, y: number, actions: MenuAction[]) => void;
}) {
  const [widgetDragging, setWidgetDragging] = useState(false);
  const [dropPreview, setDropPreview] = useState<DropPreview | null>(null);
  /** ウィジェットの幅の規則を求める。 */
  const rulesFn = (id: string) => ruleFor(id, mods);
  /** 設定に保存してある、ウィジェットの置き場所を返す。 */
  const cellsOf = () => settings.widgetCells as Record<string, Placement>;
  /**
   * 欄(ヘッダー/フッター)の、実際の置き場所を求める。
   * @param bar 欄
   */
  const layoutOf = (bar: BarId) => resolveLayout(bar, settings[barKeys(bar).list], cellsOf(), rulesFn);
  /**
   * ヘッダー・フッターの並び(ids)と置き場所(layout)を、設定へ書く。出すウィジェットがあれば、その欄を有効にする。同時に両方の欄を書き換えられる。
   * @param edits 欄ごとの、新しい並びと置き場所
   */
  const commitBars = (edits: { bar: BarId; ids: string[]; layout: Map<string, Placement> }[]) => {
    let cells = cellsOf();
    const patch: Record<string, unknown> = {};
    for (const e of edits) {
      cells = cellsWith(e.bar, cells, e.layout);
      patch[barKeys(e.bar).list] = e.ids;
      if (e.ids.length > 0) patch[barKeys(e.bar).on] = true;
    }
    changeSettings({ ...settings, ...patch, widgetCells: cells });
  };
  /** 「置く場所がない」と知らせる。 */
  const noRoom = () => flash(t("widgetNoRoom"));
  /**
   * ウィジェットを、欄の `want` マス目のあたりへ追加する(標準の幅で。入らなければ、幅を縮めて探す)。
   * @param bar 欄
   * @param id ウィジェット ID
   * @param want 置きたい開始のマス(省くと、最初の 1 つは中央、それ以外は左端から)
   * @returns 新しい並びと置き場所。置けなければ `null`
   */
  const addTo = (bar: BarId, id: string, want?: number): { ids: string[]; layout: Map<string, Placement> } | null => {
    const layout = layoutOf(bar);
    const ids = settings[barKeys(bar).list].filter((x) => x !== id);
    layout.delete(id);
    const r = rulesFn(id);
    const w = want ?? (layout.size === 0 ? Math.floor((COLS - r.def) / 2) + 1 : 1);
    const p = placeNear(layout, id, w, r.def, r);
    if (!p) return null;
    layout.set(id, p);
    return { ids: [...ids, id], layout };
  };
  /**
   * ウィジェットを、欄から外した状態の、並びと置き場所を作る。
   * @param bar 欄
   * @param id ウィジェット ID
   */
  const removeFrom = (bar: BarId, id: string) => {
    const layout = layoutOf(bar);
    layout.delete(id);
    return { bar, ids: settings[barKeys(bar).list].filter((x) => x !== id), layout };
  };
  /** 欄ごとの、設定のキー名(ウィジェットの並び `list` と、欄を使うか `on`)。 */
  const barKeys = (bar: BarId) =>
    bar === "header"
      ? ({ list: "headerWidgets", on: "headerEnabled", rows: "headerRows" } as const)
      : ({ list: "footerWidgets", on: "footerEnabled", rows: "footerRows" } as const);
  /**
   * ウィジェットを、ヘッダー/フッターに出したり、外したりする(出すときは、その欄を有効にする。置く場所がなければ、知らせる)。
   * @param bar 欄
   * @param id ウィジェット ID
   */
  const toggleWidget = (bar: BarId, id: string) => {
    if (settings[barKeys(bar).list].includes(id)) return commitBars([removeFrom(bar, id)]);
    const added = addTo(bar, id);
    if (!added) return noRoom();
    commitBars([{ bar, ...added }]);
  };
  /**
   * ウィジェットを、反対側の欄(ヘッダー ↔ フッター)へ移す。
   * @param from いまの欄
   * @param id ウィジェット ID
   */
  const moveWidget = (from: BarId, id: string) => {
    const to: BarId = from === "header" ? "footer" : "header";
    const added = addTo(to, id);
    if (!added) return noRoom();
    commitBars([removeFrom(from, id), { bar: to, ...added }]);
  };

  /**
   * ウィジェットを、別のマス(別の欄でもよい)へ動かす。同じ欄の中なら、いまの幅のまま、近くの空きへ。
   * @param id ウィジェット ID
   * @param from いまの欄
   * @param to 動かす先の欄
   * @param col 動かす先のマス(1〜7)
   */
  const onWidgetMove = (id: string, from: BarId, to: BarId, col: number) => {
    const r = rulesFn(id);
    if (from === to) {
      const layout = layoutOf(to);
      const cur = layout.get(id);
      const p = placeNear(layout, id, col, cur?.[1] ?? r.def, r);
      if (!p) return noRoom();
      layout.set(id, p);
      return commitBars([{ bar: to, ids: settings[barKeys(to).list], layout }]);
    }
    const added = addTo(to, id, col);
    if (!added) return noRoom();
    commitBars([removeFrom(from, id), { bar: to, ...added }]);
  };
  /**
   * 一覧からドラッグして、ヘッダー/フッターの `col` マス目へ追加する(すでにある欄では、そこへ動かす)。
   * @param id ウィジェット ID
   * @param bar 欄
   * @param col マス(1〜7)
   */
  const onDropWidget = (id: string, bar: BarId, col: number) => {
    if (settings[barKeys(bar).list].includes(id)) return onWidgetMove(id, bar, bar, col);
    const added = addTo(bar, id, col);
    if (!added) return noRoom();
    commitBars([{ bar, ...added }]);
  };
  /**
   * ウィジェットを動かしている間、いま離したら収まる場所(置けなければ赤い枠)を計算して、枠で示す。
   * @param id 動かしているウィジェット
   * @param x 指の x 座標
   * @param y 指の y 座標
   */
  const onWidgetPreview = (id: string, x: number, y: number) => {
    const to = locateInBars(x, y);
    let next: DropPreview | null = null;
    if (to) {
      const r = rulesFn(id);
      const layout = layoutOf(to.bar);
      const p = placeNear(layout, id, to.col, layout.get(id)?.[1] ?? r.def, r);
      next = p ? { bar: to.bar, col: p[0], span: p[1], ok: true } : { bar: to.bar, col: to.col, span: 1, ok: false };
    }
    setDropPreview((cur) =>
      cur && next && cur.bar === next.bar && cur.col === next.col && cur.span === next.span && cur.ok === next.ok
        ? cur
        : next,
    );
  };
  /**
   * ウィジェットを動かし始めた/終えた。終えたら、枠の表示も消す。
   * @param on 動かしているか
   */
  const onWidgetDragging = (on: boolean) => {
    setWidgetDragging(on);
    if (!on) setDropPreview(null);
  };
  /**
   * ヘッダー(フッター)の高さ(縦のマスの数)を変える。ヘッダー(フッター)のウィジェットは、すべて、この高さになる。
   * @param bar 欄
   * @param rows 縦のマスの数(1 = 小・2 = 標準・3 = 大)
   */
  const setBarRows = (bar: BarId, rows: number) => {
    changeSettings({ ...settings, [barKeys(bar).rows]: rows });
  };
  /**
   * ウィジェットの幅(マスの数)を変える。変えられなければ、知らせる。
   * @param bar 欄
   * @param id ウィジェット ID
   * @param span 新しい幅
   */
  const resizeWidget = (bar: BarId, id: string, span: number) => {
    const layout = layoutOf(bar);
    const p = resizeTo(layout, id, span, rulesFn(id));
    if (!p) return noRoom();
    layout.set(id, p);
    commitBars([{ bar, ids: settings[barKeys(bar).list], layout }]);
  };
  /**
   * ウィジェットの右クリックメニューを出す。幅(そのウィジェットの最小〜最大のうち、いまの場所で実際に変えられるものだけ)・反対側へ移動・外す。高さは、ウィジェットではなく、ヘッダー・フッターの右クリックで決める(`onBarMenu`)。
   * @param bar 欄
   * @param id ウィジェット ID
   * @param x メニューを出す x 座標
   * @param y メニューを出す y 座標
   */
  const onWidgetMenu = (bar: BarId, id: string, x: number, y: number) => {
    const layout = layoutOf(bar);
    const cur = layout.get(id)?.[1];
    const r = rulesFn(id);
    // 大きさ: そのウィジェットの最小〜最大(マス)のうち、いまの場所の周りで実際に変えられるものだけを出す
    const sizes: MenuAction[] = [];
    for (let n = r.min; n <= r.max; n++) {
      if (n === cur || resizeTo(layout, id, n, r))
        sizes.push({
          label: `${t("widgetSize", { n })}${n === cur ? "  ✓" : ""}`,
          run: () => n !== cur && resizeWidget(bar, id, n),
        });
    }
    showMenu(x, y, [
      ...sizes,
      { label: t(bar === "header" ? "widgetMoveFooter" : "widgetMoveHeader"), run: () => moveWidget(bar, id) },
      { label: `${t("widgetRemove")} (${widgetName(id, mods)})`, run: () => toggleWidget(bar, id), danger: true },
    ]);
  };

  /**
   * ヘッダー(フッター)の何もない所の右クリックメニューを出す。高さ(小 = 1 マス / 標準 = 2 マス / 大 = 3 マス)を選ぶ。
   * @param bar 欄
   * @param x メニューを出す x 座標
   * @param y メニューを出す y 座標
   */
  const onBarMenu = (bar: BarId, x: number, y: number) => {
    const cur = rowsFor(settings[barKeys(bar).rows]);
    showMenu(
      x,
      y,
      [
        { label: t("widgetHeightSmall"), rows: ROWS_SMALL },
        { label: t("widgetHeightAuto"), rows: ROWS_STANDARD },
        { label: t("widgetHeightLarge"), rows: ROWS_LARGE },
      ].map((o) => ({
        label: `${o.label}${cur === o.rows ? "  ✓" : ""}`,
        run: () => cur !== o.rows && setBarRows(bar, o.rows),
      })),
    );
  };

  return {
    layoutOf,
    toggleWidget,
    onWidgetMove,
    onDropWidget,
    onWidgetPreview,
    onWidgetDragging,
    onWidgetMenu,
    onBarMenu,
    widgetDragging,
    dropPreview,
  };
}
