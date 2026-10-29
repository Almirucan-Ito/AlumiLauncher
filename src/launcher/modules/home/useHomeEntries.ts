import { useEffect, useMemo, useRef } from "react";
import { type Config, api } from "../../shared/api/ApiModel";
import { useFolderItems } from "../folders/useFolderItems";
import { whenIconsSettled } from "../icons/IconController";
import { HOME_ORDER_KEY, type HomeEntry, entryKey } from "./HomeModel";

/**
 * ホームに並べるもの(フォルダ + ホームに直接置いたショートカット)を、ドラッグで変えた順(`HOME_ORDER_KEY`)に並べる。
 * あわせて、起動時に、設定・ホームの一覧・アイコンが揃ってから、ウィンドウを出す(アイコンが途中で入れ替わって見えないように)。
 *
 * @param config 画面に出している設定(読み込み前は `null`)
 * @param launcherPath ホームのアイコンの保存先(launcherFolder)のパス(分かるまでは空)
 * @param tick ホームの保存先の再読み込みの番号(変わると、一覧を取り直す)
 * @returns `entries` ホームの並び(並び順にないものは、元の順のまま、後ろへ) / `homeKeys` ホームにあるものの識別子(設定とホームの一覧が読み込めるまでは `null`)
 */
export function useHomeEntries(
  config: Config | null,
  launcherPath: string,
  tick: number,
): { entries: HomeEntry[]; homeKeys: ReadonlySet<string> | null } {
  const looseItems = useFolderItems(launcherPath, tick);

  const readySent = useRef(false);
  useEffect(() => {
    if (readySent.current || !config || !launcherPath || looseItems === undefined) return;
    readySent.current = true;
    whenIconsSettled(3500).then(() => api.appReady());
  }, [config, launcherPath, looseItems]);

  const folders = config?.folders;
  const homeOrder = config?.orders?.[HOME_ORDER_KEY];
  const entries = useMemo<HomeEntry[]>(() => {
    const all: HomeEntry[] = [
      ...(folders ?? []).map((folder): HomeEntry => ({ kind: "folder", folder })),
      ...(looseItems ?? []).map((item): HomeEntry => ({ kind: "item", item })),
    ];
    if (!homeOrder?.length) return all;
    const rank = new Map(homeOrder.map((k, i) => [k, i]));
    const big = homeOrder.length;
    return all
      .map((e, i) => ({ e, i }))
      .sort((a, b) => (rank.get(entryKey(a.e)) ?? big) - (rank.get(entryKey(b.e)) ?? big) || a.i - b.i)
      .map((x) => x.e);
  }, [folders, looseItems, homeOrder]);
  const ready = !!config && !!launcherPath && looseItems !== undefined;
  const homeKeys = useMemo(() => (ready ? new Set(entries.map(entryKey)) : null), [entries, ready]);
  return { entries, homeKeys };
}
