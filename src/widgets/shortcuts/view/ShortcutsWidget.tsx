import "./style.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { DROP_EVENT, type DropDetail, type WidgetEnv } from "../../../launcher/modules/plugins/PluginModel";
import { PREVIEW_SLOTS, applyOrder } from "../../../launcher/modules/folders/FolderModel";
import { useFolderItems } from "../../../launcher/modules/folders/useFolderItems";
import { useIcon } from "../../../launcher/modules/icons/IconController";
import { MiniAppIcon } from "../../../launcher/modules/miniapps/MiniAppPicker";
import { api, miniAppLabel, type MiniApp } from "../../../launcher/shared/api/ApiModel";
import { appData, useAppData } from "../../../launcher/shared/api/AppDataModel";
import { isMiniShortcut } from "../../../launcher/shared/lib/PathUtil";
import { IconImg } from "../../../launcher/shared/ui/IconImg";
import { t } from "../i18n";
import {
  MAX_PER_ROW,
  SHORTCUTS_KEY,
  addShortcut,
  entryFromDrop,
  iconLayout,
  moveShortcut,
  slotIndex,
  parseShortcuts,
  pruneShortcuts,
  removeShortcut,
  shortcutKey,
  type ShortcutEntry,
} from "../model/ShortcutsModel";

/** このウィジェットのデータの置き場所(widgets フォルダの名前)。 */
const WIDGET_ID = "shortcuts";
/** ここまで動かしたら、クリックではなく、並べ替えのドラッグとみなす(px)。 */
const DRAG_THRESHOLD = 6;

/**
 * 一覧を、ウィジェットのデータとして保存する。
 * @param list 保存する一覧
 */
const save = (list: ShortcutEntry[]) => appData.set("widget", WIDGET_ID, SHORTCUTS_KEY, JSON.stringify(list));

/** 並べ替えのドラッグの途中の状態(動かしている項目の番号・指の動き・落とす位置の番号)。 */
interface DragState {
  from: number;
  dx: number;
  dy: number;
  to: number;
}

/**
 * フォルダのアイコン。ホームと同じように、中のアイコンを 3×3 の 9 マス(最大 9 個。並びは、ホーム・フォルダを開いたときと同じ)で見せる。
 * @param entry フォルダの項目
 * @param order そのフォルダの並び順
 * @param tick フォルダの一覧の再読み込みの番号(変わると、中身を取り直す。ホームのフォルダと同じ)
 */
function FolderPlate({
  entry,
  order,
  tick,
}: {
  entry: Extract<ShortcutEntry, { kind: "folder" }>;
  order: string[] | undefined;
  tick: number;
}) {
  const raw = useFolderItems(entry.path, tick);
  const preview = useMemo(() => applyOrder(raw ?? [], order).slice(0, PREVIEW_SLOTS), [raw, order]);
  return (
    <span className="plate folder">
      {preview.map((it) => (
        <IconImg key={it.path} item={it} className="mini" />
      ))}
    </span>
  );
}

/**
 * アイコン(ファイル)の絵。
 * @param entry アイコンの項目
 */
function ItemIcon({ entry }: { entry: Extract<ShortcutEntry, { kind: "item" }> }) {
  const src = useIcon({ name: entry.name, path: entry.path });
  return src ? <img src={src} alt="" draggable={false} /> : <span className="ghost" />;
}

/**
 * 1 つぶんの、押せるアイコン。アイコン(ファイル)は起動、フォルダとミニアプリは、ランチャーの中で開く。
 * 右クリックで登録を解除でき、押したまま動かすと、順番を変えられる(動かしている間は、`drag` の指の動きだけずらして描く)。
 * @param props `entry` 項目 / `order` フォルダの並び順 / `tick` フォルダの再読み込みの番号 / `mini` ミニアプリのとき、その情報 / `drag` 動かしている間の、ずらす量(動かしていなければ `null`) / `over` 落とす位置か / `onPointerDown` `onPointerMove` `onPointerUp` ドラッグの受け口 / `onMenu` 右クリック / `consumeClick` ドラッグの直後なら `true`(クリックを無視する)
 */
function ShortcutCell({
  entry,
  order,
  tick,
  mini,
  drag,
  over,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onMenu,
  consumeClick,
}: {
  entry: ShortcutEntry;
  order: string[] | undefined;
  tick: number;
  mini: MiniApp | undefined;
  drag: { dx: number; dy: number } | null;
  over: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onMenu: (e: React.MouseEvent) => void;
  consumeClick: () => boolean;
}) {
  const open = () => {
    if (consumeClick()) return;
    if (entry.kind === "folder") window.dispatchEvent(new CustomEvent("alumi:open-folder-id", { detail: entry.id }));
    else if (entry.kind === "mini")
      window.dispatchEvent(new CustomEvent("alumi:open-miniapp-id", { detail: entry.id }));
    else void api.launch(entry.path);
  };
  return (
    <div
      className={`wshort wno-move${drag ? " dragging" : ""}${over ? " over" : ""}`}
      style={drag ? { transform: `translate(${drag.dx}px, ${drag.dy}px)` } : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={onMenu}
    >
      <button
        className="wshort-open"
        title={entry.kind === "mini" && mini ? miniAppLabel(mini) : entry.name}
        onClick={open}
      >
        {entry.kind === "folder" ? (
          <FolderPlate entry={entry} order={order} tick={tick} />
        ) : entry.kind === "mini" ? (
          mini ? (
            <MiniAppIcon app={mini} size={64} />
          ) : (
            <span className="ghost" />
          )
        ) : (
          <ItemIcon entry={entry} />
        )}
      </button>
    </div>
  );
}

/**
 * ショートカットウィジェット。ホームのアイコン・フォルダ・ミニアプリを、ドラッグして入れておける(元のものは、そのまま残る)。
 * あくまでホームにあるものの近道なので、ホームから無くなったものは、ここからも外す(ミニアプリだけは、ホームではなく、ミニアプリのフォルダに無いとき)。
 * ドロップは、ランチャー本体が `alumi:drop` のイベントで知らせてくる(`data-drop-target` を付けた要素に届く)。
 * 並べ方は、高さで決まる(`iconLayout`): 小・標準は 1 段、大は 2 段。1 段に置けるのは 6 個まで。
 * 登録の解除は、アイコンの右クリック。順番は、アイコンをドラッグして変える。
 * @param props `env` ランチャーの窓口(通知・右クリックメニューに使う)
 */
export function ShortcutsWidget({ env }: { env: WidgetEnv }) {
  const store = useAppData("widget", WIDGET_ID);
  const all = parseShortcuts(store[SHORTCUTS_KEY]);
  const root = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const envRef = useRef(env);
  envRef.current = env;
  const [layout, setLayout] = useState(() => iconLayout(0, 0, 44));
  const capacityRef = useRef(layout.capacity);
  capacityRef.current = layout.capacity;
  // 高さが低くて置けないぶんは、保存したまま出さない(高さを戻すと、また出る)
  const list = all.slice(0, layout.capacity);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<{ from: number; sx: number; sy: number; moving: boolean } | null>(null);
  const justDragged = useRef(0);

  // 参照先が無くなったものを、強制的に外す(読み込めるまでは、何もしない)。
  // ホームのミニアプリのアイコン(`.alumiapp`)を、以前の版で入れていたものは、ミニアプリの項目に直す(ホームから消えていて、直せないものは、外す)
  const raw = store[SHORTCUTS_KEY];
  const { homeKeys, minis } = env;
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let cur = parseShortcuts(raw);
      const legacy = cur.filter((e) => e.kind === "item" && isMiniShortcut(e.path) && homeKeys?.has(shortcutKey(e)));
      if (legacy.length > 0) {
        const fixed = new Map<string, ShortcutEntry>();
        for (const e of legacy) {
          if (e.kind !== "item") continue;
          const id = await api.miniAppOfFile(e.path).catch(() => "");
          if (id) fixed.set(shortcutKey(e), { kind: "mini", id, name: e.name.replace(/\.alumiapp$/i, "") });
        }
        cur = cur.map((e) => fixed.get(shortcutKey(e)) ?? e);
        // 同じミニアプリが 2 つにならないようにする
        cur = cur.filter((e, i) => cur.findIndex((x) => shortcutKey(x) === shortcutKey(e)) === i);
      }
      if (cancelled) return;
      const kept = pruneShortcuts(cur, homeKeys, minis ? new Set(minis.map((m) => m.id)) : null);
      if (kept !== cur || JSON.stringify(kept) !== JSON.stringify(parseShortcuts(raw))) save(kept);
    })();
    return () => {
      cancelled = true;
    };
  }, [raw, homeKeys, minis]);

  // 大きさ(幅・高さ・マスの大きさ)が変わるたびに、並べ方を決め直す
  useEffect(() => {
    const el = root.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => {
      const cell = parseFloat(getComputedStyle(el).getPropertyValue("--wcell")) || 44;
      setLayout(iconLayout(el.clientWidth, el.clientHeight, cell));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const onDrop = async (e: Event) => {
      const detail = (e as CustomEvent<DropDetail>).detail;
      let entry = entryFromDrop(detail);
      // ホームのミニアプリのアイコンは、ミニアプリのフォルダを参照する項目にする
      if (entry.kind === "item" && isMiniShortcut(entry.path)) {
        const id = await api.miniAppOfFile(entry.path).catch(() => "");
        if (id) entry = { kind: "mini", id, name: entry.name.replace(/\.alumiapp$/i, "") };
      }
      // 保存の待ち時間の間に続けて落とされても、取りこぼさないよう、いま覚えている最新の内容に足す
      const cur = parseShortcuts(appData.map("widget", WIDGET_ID)[SHORTCUTS_KEY]);
      const r = addShortcut(cur, entry, capacityRef.current);
      if (r.reason === "exists") envRef.current.flash(t("shortcutsExists", { name: entry.name }));
      else if (r.reason === "full") envRef.current.flash(t("shortcutsFull", { n: capacityRef.current }));
      else {
        save(r.list);
        envRef.current.flash(t("shortcutsAdded", { name: entry.name }));
      }
    };
    // 横にはみ出したときは、ホイールで、横に動かす
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY || e.deltaX;
    };
    el.addEventListener(DROP_EVENT, onDrop);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener(DROP_EVENT, onDrop);
      el.removeEventListener("wheel", onWheel);
    };
  }, []);

  /**
   * 指の位置の下にある、アイコンの番号(行・列から求める。一覧の外なら、いちばん近い端)。
   * @param x 画面の x 座標
   * @param y 画面の y 座標
   */
  const indexAt = (x: number, y: number) => {
    const r = grid.current?.getBoundingClientRect();
    if (!r) return 0;
    return slotIndex(x, y, r, layout.side, layout.rows, list.length);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>, from: number) => {
    if (e.button !== 0) return;
    dragRef.current = { from, sx: e.clientX, sy: e.clientY, moving: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || e.buttons === 0) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moving) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      d.moving = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* すでにポインタが離れている */
      }
    }
    setDrag({ from: d.from, dx, dy, to: indexAt(e.clientX, e.clientY) });
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d?.moving) return;
    justDragged.current = Date.now();
    setDrag(null);
    if (e.type === "pointerup") save(moveShortcut(all, d.from, indexAt(e.clientX, e.clientY)));
  };

  return (
    <div ref={root} className="wcard wshortcuts" data-drop-target="shortcuts" aria-label={t("shortcutsLabel")}>
      {list.length === 0 && <span className="wdim wshort-empty">{t("shortcutsEmpty")}</span>}
      <div
        ref={grid}
        className="wshort-grid"
        style={
          {
            "--sc": `${layout.side}px`,
            gridTemplateColumns: `repeat(${Math.min(MAX_PER_ROW, Math.max(1, list.length))}, ${layout.side}px)`,
          } as React.CSSProperties
        }
      >
        {list.map((e, i) => (
          <ShortcutCell
            key={shortcutKey(e)}
            entry={e}
            order={e.kind === "folder" ? env.folderOrder(e.id) : undefined}
            tick={e.kind === "folder" ? env.folderTick(e.path) : 0}
            mini={e.kind === "mini" ? minis?.find((m) => m.id === e.id) : undefined}
            drag={drag?.from === i ? drag : null}
            over={!!drag && drag.to === i && drag.from !== i}
            onPointerDown={(ev) => onPointerDown(ev, i)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onMenu={(ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              env.showMenu(ev.clientX, ev.clientY, [
                {
                  label: t("shortcutsRemove", { name: e.name }),
                  run: () => save(removeShortcut(all, shortcutKey(e))),
                  danger: true,
                },
              ]);
            }}
            consumeClick={() => Date.now() - justDragged.current < 200}
          />
        ))}
      </div>
    </div>
  );
}
