import { useEffect, useRef, useState } from "react";
import { widgetConsentKey, widgetKey, widgetLabel, widgetUrl, type ModWidget } from "../../shared/api/ApiModel";
import { COLS, cellSide, cellWidth, colAtX, rowsFor, rowsToPx, type BarId, type Placement } from "./LayoutModel";
import { widgetPlugins } from "../plugins/PluginRegistry";
import type { WidgetEnv } from "../plugins/PluginModel";
import { t } from "../../shared/i18n/i18n";

/** ヘッダー・フッターのどちらか(置き場所の計算は LayoutModel.ts) */
export type { BarId };

/** ウィンドウの高さがこれより小さいときは、ヘッダー・フッターを出さない(px)。 */
export const BARS_MIN_HEIGHT = 380;
/** ウィンドウの幅がこれより小さいときは、ヘッダー・フッターを出さない(px)。 */
export const BARS_MIN_WIDTH = 300;

/**
 * 追加ウィジェット(Mod)の表示。widgets フォルダの HTML を、sandbox 付きの iframe で表示する。ランチャーの機能やファイルには触れない。外部との通信は、宣言して同意したものだけ(CSP で制限)。
 * 読み込み後に、いまの文字色などを postMessage で渡す(ウィジェット側は、受け取っても受け取らなくてもよい)。
 * @param info 表示するウィジェット
 */
function ModFrame({ info }: { info: ModWidget }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const post = () => {
    const el = frame.current;
    if (!el?.contentWindow) return;
    const css = getComputedStyle(el);
    el.contentWindow.postMessage({ type: "alumi:theme", text: css.color, lang: navigator.language }, "*");
  };
  return (
    <div className="wmod" style={{ width: info.width, height: info.height }} title={info.name}>
      <iframe
        ref={frame}
        title={info.name}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        src={widgetUrl(info, info.entry)}
        onLoad={post}
      />
    </div>
  );
}

/**
 * 指の位置から、どの欄(ヘッダー/フッター)の、何マス目(1〜7)かを求める。
 * @param x 画面の x 座標
 * @param y 画面の y 座標
 * @returns 欄とマス。どの欄の上でもなければ `null`
 */
export function locateInBars(x: number, y: number): { bar: BarId; col: number } | null {
  for (const el of document.querySelectorAll<HTMLElement>(".wbar")) {
    const r = el.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
    const cs = getComputedStyle(el);
    const [pl, pr] = [parseFloat(cs.paddingLeft) || 0, parseFloat(cs.paddingRight) || 0];
    const colWidth = parseFloat(el.dataset.colWidth ?? "") || cellWidth(r.width - pl - pr);
    const col = colAtX(x, r.left + pl, r.width - pl - pr, colWidth);
    return { bar: el.classList.contains("wbar-header") ? "header" : "footer", col };
  }
  return null;
}

/** 動かしているウィジェットを、いま離したら収まる場所(`bar` 欄の `col` マス目から `span` マス)。置けないときは `ok` が `false`。 */
export interface DropPreview {
  bar: BarId;
  col: number;
  span: number;
  ok: boolean;
}

/** ウィジェットを掴んで動かしている間の状態(動かしている ID・ずれ・指の下の欄)。 */
type Drag = { id: string; dx: number; dy: number; over: BarId | null };

/**
 * ヘッダー・フッターの 1 段。横に 7 マスに区切られていて、ウィジェットは、決まったマスに置かれる。
 * ウィジェットを長押し(追加ウィジェットは左上の ⋮⋮ を掴む)すると移動できる。右クリックで、大きさ(マスの数)・高さの変更、反対側へ移動、外すができる。
 * 外部と通信すると宣言しているのに、まだ同意していない追加ウィジェットは、読み込まずに、確認のカードを出す。
 * @param props `bar` 欄 / `ids` 並べるウィジェット / `layout` 実際の置き場所 / `mods` 追加ウィジェット / `env` 窓口 / `onMenu` 右クリック / `onMove` 移動 / `onDragging` 移動中の通知 / `dragDelayMs` 長押しの時間 / `modsLoaded` 一覧を読み終えたか / `networkAllowed`・`onAskNetwork` 通信の同意 / `rows` 欄の高さ(小 / 標準 / 大)/ `onBarMenu` 欄の右クリック / `preview`・`onPreview` 落とす場所の表示
 */
export function WidgetBar({
  bar,
  ids,
  layout,
  mods,
  env,
  onMenu,
  onMove,
  onDragging,
  dragDelayMs,
  modsLoaded,
  networkAllowed,
  onAskNetwork,
  rows,
  onBarMenu,
  preview,
  onPreview,
}: {
  bar: BarId;
  ids: string[];
  /** 実際の置き場所(ID → [開始のマス, 幅]) */
  layout: Map<string, Placement>;
  mods: ModWidget[];
  env: WidgetEnv;
  onMenu: (bar: BarId, id: string, x: number, y: number) => void;
  /** to の欄の col マス目へ移動(同じ欄の中でもよい) */
  onMove: (id: string, from: BarId, to: BarId, col: number) => void;
  onDragging: (on: boolean) => void;
  /** 長押しで移動を始めるまでの時間(ms) */
  dragDelayMs: number;
  /** 外部との通信に同意したウィジェット(キーは widgetConsentKey)と、まだのものを使うときの確認 */
  networkAllowed: string[];
  onAskNetwork: (info: ModWidget) => void;
  /** widgets フォルダの一覧を読み終えたか(読み終えたあとは、組み込みのウィジェットも、フォルダがあるものだけ出す) */
  modsLoaded: boolean;
  /** この欄の高さ = 縦のマスの数(1 = 小・2 = 標準・3 = 大)。欄のウィジェットは、すべて、この高さ */
  rows: number;
  /** 欄の何もない所を右クリックしたとき(高さを選ぶメニュー) */
  onBarMenu: (bar: BarId, x: number, y: number) => void;
  /** 動かしているウィジェットの、落とした場合の置き場所(この欄のものだけ枠で示す) */
  preview: DropPreview | null;
  /** 動かしている間、指の位置を知らせる(置き場所を計算してもらう) */
  onPreview: (id: string, x: number, y: number) => void;
}) {
  const [drag, setDrag] = useState<Drag | null>(null);
  // マスの大きさ: 欄の幅から決める。高さは固定(狭いときだけ縮む)、横幅は、広いウィンドウでは上限(CELL_WIDTH)まで広がる
  const barRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = barRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => setWidth(Math.round(entries[0].contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const measured = width > 0 ? width : COLS * 30 + (COLS - 1) * 4;
  const side = cellSide(measured);
  const colWidth = cellWidth(measured);
  const nRows = rowsFor(rows);
  const height = rowsToPx(nRows, side);
  // 移動の途中で欄が消えても(ウィンドウが小さくなったときなど)、「動かし中」の状態を残さない
  const cancelMove = useRef<(() => void) | null>(null);
  useEffect(() => () => cancelMove.current?.(), []);

  /**
   * 移動を始める。途中で途切れたとき(スクリーンショットなどで、ウィンドウからフォーカスが外れたとき)も、状態を残さないよう片付ける。
   * @param el ポインタを捕まえておく要素(動かしている間のイベントを受ける)
   * @param pointerId ポインタの ID
   * @param sx 押した位置の x
   * @param sy 押した位置の y
   * @param id 動かすウィジェットの ID
   */
  const beginDrag = (el: HTMLElement, pointerId: number, sx: number, sy: number, id: string) => {
    try {
      el.setPointerCapture(pointerId);
    } catch {
      /* すでにポインタが離れている */
    }
    onDragging(true);
    setDrag({ id, dx: 0, dy: 0, over: bar });
    const move = (m: PointerEvent) => {
      setDrag({ id, dx: m.clientX - sx, dy: m.clientY - sy, over: locateInBars(m.clientX, m.clientY)?.bar ?? null });
      onPreview(id, m.clientX, m.clientY);
    };
    const finish = (drop: PointerEvent | null) => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", abort);
      el.removeEventListener("lostpointercapture", abort);
      window.removeEventListener("blur", abort);
      cancelMove.current = null;
      justDragged.current = Date.now();
      setDrag(null);
      onDragging(false);
      const to = drop ? locateInBars(drop.clientX, drop.clientY) : null;
      if (to) onMove(id, bar, to.bar, to.col);
    };
    const up = (u: PointerEvent) => finish(u);
    const abort = () => finish(null);
    cancelMove.current = abort;
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", abort);
    el.addEventListener("lostpointercapture", abort);
    window.addEventListener("blur", abort);
  };

  /**
   * ウィジェットを押したとき。設定の「長押し」の時間が過ぎたら、移動を始める。それまでに 8px 以上動いたり、離したりしたら、ふつうのクリックとして扱う(入力欄・iframe・つまみの上は除く)。
   * @param e ポインタのイベント
   * @param id ウィジェットの ID
   */
  const onPress = (e: React.PointerEvent<HTMLElement>, id: string) => {
    if (
      e.button !== 0 ||
      (e.target as HTMLElement).closest("input, textarea, select, iframe, .wgrip, .wheight, .wno-move")
    )
      return;
    const el = e.currentTarget;
    const [sx, sy, pid] = [e.clientX, e.clientY, e.pointerId];
    const stop = () => {
      clearTimeout(timer);
      el.removeEventListener("pointermove", mv);
      el.removeEventListener("pointerup", stop);
      el.removeEventListener("pointercancel", stop);
    };
    const mv = (m: PointerEvent) => Math.hypot(m.clientX - sx, m.clientY - sy) > 8 && stop();
    const timer = window.setTimeout(() => {
      stop();
      beginDrag(el, pid, sx, sy, id);
    }, dragDelayMs);
    el.addEventListener("pointermove", mv);
    el.addEventListener("pointerup", stop);
    el.addEventListener("pointercancel", stop);
  };
  const justDragged = useRef(0);

  return (
    <div
      ref={barRef}
      className={`wbar wbar-${bar}${drag ? " dragging" : ""}${drag?.over === bar ? " over" : ""}`}
      data-col-width={colWidth}
      style={{ "--wcell": `${side}px`, "--wcol": `${colWidth}px` } as React.CSSProperties}
      role="region"
      aria-label={t(bar === "header" ? "widgetHeader" : "widgetFooter")}
      data-tauri-drag-region
      onContextMenu={(e) => {
        e.preventDefault();
        onBarMenu(bar, e.clientX, e.clientY);
      }}
    >
      {/* 動かしている間の、マスの目印: 横 7 マス × 欄の高さのぶん。1 マスは、横が --wcol、縦が --wcell */}
      {drag &&
        Array.from({ length: COLS * nRows }, (_, i) => (
          <div
            key={`c${i}`}
            className="wcell"
            style={{ gridColumn: (i % COLS) + 1, gridRow: Math.floor(i / COLS) + 1 }}
          />
        ))}
      {/* 落とした場合に、ウィジェット全体が収まる場所を、枠で示す(置けないときは、赤い枠) */}
      {preview && preview.bar === bar && (
        <div
          className={`wdrop${preview.ok ? "" : " bad"}`}
          style={{ gridColumn: `${preview.col} / span ${preview.span}`, gridRow: `1 / span ${nRows}` }}
        />
      )}
      {ids.map((id) => {
        const place = layout.get(id);
        if (!place) return null; // 置ける場所が無いものは、表示しない
        let body = null;
        // 組み込みのウィジェットの部品は、各フォルダ(src/widgets・src/miniapps)が登録したもの(PluginRegistry)
        const plugin = widgetPlugins[id];
        // 組み込みのウィジェットは、widgets フォルダに定義(widget.json)があるものだけ出す(消したものは、出さない)
        if (plugin && modsLoaded && !mods.some((m) => m.builtin === id)) return null;
        if (plugin) body = <plugin.component env={env} />;
        else if (id.startsWith("mod:") || id.startsWith("mini:")) {
          const info = mods.find((m) => widgetKey(m) === id);
          // 通信すると宣言しているのに、まだ同意していないものは、読み込まずに、確認のカードを出す(フォルダが消えたものは、何も出さない)
          if (info)
            body =
              info.network && !networkAllowed.includes(widgetConsentKey(info)) ? (
                <div className="wcard wconsent">
                  <span>{t("consentWidget", { name: widgetLabel(info) })}</span>
                  <button className="small primary" onClick={() => onAskNetwork(info)}>
                    {t("consentCheck")}
                  </button>
                </div>
              ) : (
                <ModFrame info={info} />
              );
        }
        if (!body) return null;
        const moving = drag?.id === id;
        // 高さは、欄の高さ(ヘッダー・フッターを右クリックして決める)。中身は、ウィジェット自身が、高さに合わせて切り替える
        return (
          <div
            key={id}
            data-wid={id}
            className={`widget hfixed${moving ? " moving" : ""}`}
            style={{
              gridColumn: `${place[0]} / span ${place[1]}`,
              gridRow: `1 / span ${nRows}`,
              height,
              transform: moving ? `translate(${drag.dx}px, ${drag.dy}px)` : undefined,
            }}
            onPointerDown={(e) => onPress(e, id)}
            // 移動したあとに離したとき、下にあったボタンが押されたことにならないように
            onClickCapture={(e) => {
              if (Date.now() - justDragged.current < 200) {
                e.stopPropagation();
                e.preventDefault();
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onMenu(bar, id, e.clientX, e.clientY);
            }}
          >
            {body}
            {/* 追加ウィジェット(iframe)は、中で長押ししても、こちらには届かない。そのため、つまみ(⋮⋮)から、すぐに動かせるようにする */}
            {(id.startsWith("mod:") || id.startsWith("mini:")) && (
              <span
                className="wgrip"
                title={t("widgetMoveHint")}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  beginDrag(e.currentTarget, e.pointerId, e.clientX, e.clientY, id);
                }}
              >
                <svg viewBox="0 0 10 14" width="10" height="14" fill="currentColor">
                  <circle cx="3" cy="3" r="1.2" />
                  <circle cx="7" cy="3" r="1.2" />
                  <circle cx="3" cy="7" r="1.2" />
                  <circle cx="7" cy="7" r="1.2" />
                  <circle cx="3" cy="11" r="1.2" />
                  <circle cx="7" cy="11" r="1.2" />
                </svg>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
