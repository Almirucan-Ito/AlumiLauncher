import { api, type Config } from "../../shared/api/ApiModel";
import { t } from "../../shared/i18n/i18n";
import { type MenuAction } from "../../shared/ui/MenuModel";
import { type OpenFolder } from "../folders/FolderModel";
import { type usePickers } from "./usePickers";

/**
 * 右下の「＋」ボタンの動き。フォルダを開いていればそこへファイルを追加し、開いていなければ、メニュー(フォルダを追加 / スタートメニューから追加 / ウィジェットを追加 / ミニアプリ)を出す。
 * @param config いまの設定(読み込み前は何もしない)
 * @param open 開いているフォルダ
 * @param showMenu メニューを出す関数
 * @param addPaths フォルダへファイルを追加する関数
 * @param pickAndAddFolder フォルダを選んで、ホームに追加する関数
 * @param pickers 追加の画面を開く関数(`usePickers`)
 * @returns ボタンの `onClick`
 */
export function usePlusButton({
  config,
  open,
  showMenu,
  addPaths,
  pickAndAddFolder,
  pickers,
}: {
  config: Config | null;
  open: OpenFolder | null;
  showMenu: (x: number, y: number, actions: MenuAction[]) => void;
  addPaths: (folder: OpenFolder["folder"], paths: string[]) => Promise<void> | void;
  pickAndAddFolder: () => void;
  pickers: Pick<ReturnType<typeof usePickers>, "openStartPicker" | "openWidgetPicker" | "openMiniPicker">;
}) {
  return async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!config) return;
    if (open) {
      await addPaths(open.folder, await api.pickFiles());
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    showMenu(r.left, r.top - 4 * 36 - 12, [
      { label: t("addFolder"), run: pickAndAddFolder },
      { label: t("addFromStart"), run: pickers.openStartPicker },
      { label: t("addWidget"), run: pickers.openWidgetPicker },
      { label: t("openMini"), run: pickers.openMiniPicker },
    ]);
  };
}
