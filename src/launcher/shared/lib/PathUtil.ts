/**
 * パスから、ファイル(フォルダ)の名前を取り出す。`\` と `/` のどちらの区切りでもよい。
 * @param path パス
 * @returns 最後の名前(取り出せなければ、パスそのもの)
 */
export const fileLabel = (path: string): string => path.split(/[\\/]/).pop() ?? path;

/**
 * ホームのミニアプリのアイコン(`.alumiapp`)か。
 * @param path ファイルのパス
 */
export const isMiniShortcut = (path: string) => path.toLowerCase().endsWith(".alumiapp");
