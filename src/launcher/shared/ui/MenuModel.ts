/** 右クリックメニューの 1 項目(`danger` は、削除などの危険な操作の色にする)。 */
export type MenuAction = { label: string; run: () => void; danger?: boolean };

/** 開いているメニュー(表示位置と、項目)。 */
export type MenuState = { x: number; y: number; actions: MenuAction[] };
