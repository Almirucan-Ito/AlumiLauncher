import { defineMessages } from "../../launcher/shared/lib/MessageUtil";

/** ショートカットウィジェットの文言。 */
export const t = defineMessages(
  {
    shortcutsEmpty: "ホームのアイコン・フォルダを、ここへドラッグ",
    shortcutsAdded: "「{name}」を追加しました",
    shortcutsExists: "「{name}」は、もう入っています",
    shortcutsFull: "これ以上は入れられません(いまの高さでは {n} 個まで)",
    shortcutsRemove: "「{name}」の登録を解除",
    shortcutsLabel: "ショートカット",
  },
  {
    shortcutsEmpty: "Drag icons and folders here from Home",
    shortcutsAdded: 'Added "{name}"',
    shortcutsExists: '"{name}" is already here',
    shortcutsFull: "No more room (up to {n} at this height)",
    shortcutsRemove: 'Remove "{name}" from Shortcuts',
    shortcutsLabel: "Shortcuts",
  },
);
