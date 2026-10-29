import { type Item, api } from "../api/ApiModel";
import { isMiniShortcut } from "../lib/PathUtil";
import { IconImg } from "./IconImg";
import { memo } from "react";

/**
 * アプリ(ファイル)1 つのアイコン。押すと起動する(`.alumiapp` はミニアプリを開く)。ラベルは、`.lnk` / `.url` / `.alumiapp` の拡張子を除いて出す。
 * @param item 対象のファイル
 * @param onMenu 右クリックされたとき
 * @param bare ホームに直接置いた単独のアイコン(周りの枠を付けず、アイコンを大きく表示する)
 */
export const AppTile = memo(function AppTile({
  item,
  onMenu,
  bare = false,
}: {
  item: Item;
  onMenu: (item: Item, x: number, y: number) => void;
  /** ホームに直接置いた単独のアイコン: 周りの枠(膜)を付けず、アイコンを大きく表示する */
  bare?: boolean;
}) {
  return (
    <button
      className={`tile${bare ? " bare" : ""}`}
      title={item.name}
      onClick={() =>
        isMiniShortcut(item.path)
          ? window.dispatchEvent(new CustomEvent("alumi:open-miniapp", { detail: item.path }))
          : api.launch(item.path)
      }
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onMenu(item, e.clientX, e.clientY);
      }}
    >
      <span className="plate">
        <IconImg item={item} className="icon" />
      </span>
      <span className="label">{item.name.replace(/\.(alumiapp|lnk|url)$/i, "")}</span>
    </button>
  );
});
