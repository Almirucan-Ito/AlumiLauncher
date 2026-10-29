import { type MiniApp } from "../../shared/api/ApiModel";
import { type Config } from "../../shared/api/ApiModel";
import { type MenuAction } from "../../shared/ui/MenuModel";
import { type WidgetEnv } from "../plugins/PluginModel";

/**
 * ウィジェットが、アプリの状態を使うための窓口(`WidgetEnv`)を作る。
 * @param o `query` `setQuery` `onSearchEnter` ホームの絞り込み / `flash` 一言出す / `showMenu` 右クリックメニュー / `config` いまの設定(フォルダの並び順を読む) / `tickFor` フォルダの再読み込みの番号 / `homeKeys` ホームにあるもの / `minis` ミニアプリの一覧
 */
export function useWidgetEnv(o: {
  query: string;
  setQuery: (q: string) => void;
  onSearchEnter: () => void;
  flash: (msg: string) => void;
  showMenu: (x: number, y: number, actions: MenuAction[]) => void;
  config: Config | null;
  tickFor: (path: string) => number;
  homeKeys: ReadonlySet<string> | null;
  minis: MiniApp[] | null;
}): WidgetEnv {
  const { query, setQuery, onSearchEnter, flash, showMenu, config, tickFor, homeKeys, minis } = o;
  return {
    query,
    setQuery,
    onSearchEnter,
    flash,
    showMenu,
    folderOrder: (id) => config?.orders?.[id],
    folderTick: tickFor,
    homeKeys,
    minis,
  };
}
