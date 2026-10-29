import { type Origin, PREVIEW_SLOTS, applyOrder } from "./FolderModel";
import { useFolderItems } from "./useFolderItems";
import { type FolderEntry } from "../../shared/api/ApiModel";
import { IconImg } from "../../shared/ui/IconImg";
import { useMemo } from "react";

/**
 * ホームのフォルダのアイコン。中のアイコンを 3×3 の 9 マス(最大 9 個。並びは、フォルダを開いたときと同じ)で見せる。
 * @param folder 対象のフォルダ
 * @param order そのフォルダの並び順
 * @param reload 変わったら、一覧を取り直す
 * @param onOpen 開くとき(開く起点つき)
 * @param onMenu 右クリックされたとき
 */
export function FolderTile({
  folder,
  order,
  reload,
  onOpen,
  onMenu,
}: {
  folder: FolderEntry;
  order: string[] | undefined;
  reload: number;
  onOpen: (f: FolderEntry, o: Origin) => void;
  onMenu: (f: FolderEntry, x: number, y: number) => void;
}) {
  const raw = useFolderItems(folder.path, reload);
  // フォルダアイコンは 3×3 の9マス固定で、最大9個まで表示する(9個未満のときは空きマスに何も描かない)。並びはフォルダを開いたときと同じ
  const preview = useMemo(() => applyOrder(raw ?? [], order).slice(0, PREVIEW_SLOTS), [raw, order]);
  return (
    <button
      className="tile"
      title={folder.path}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        onOpen(folder, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation(); // ホームの右クリックメニューではなく、フォルダのメニューを出す
        onMenu(folder, e.clientX, e.clientY);
      }}
    >
      <span className="plate folder">
        {preview.map((it) => (
          <IconImg key={it.path} item={it} className="mini" />
        ))}
      </span>
      <span className="label">{folder.name}</span>
    </button>
  );
}
