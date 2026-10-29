import { useIcon } from "../../modules/icons/IconController";
import { type Item } from "../api/ApiModel";
import { memo } from "react";

/** アイコンの画像。取得できるまでは、空の枠(`ghost`)を出す。 */
export const IconImg = memo(function IconImg({ item, className }: { item: Item; className?: string }) {
  const src = useIcon(item);
  return src ? (
    <img className={className} src={src} alt="" draggable={false} decoding="async" />
  ) : (
    <span className={`${className ?? ""} ghost`} />
  );
});
