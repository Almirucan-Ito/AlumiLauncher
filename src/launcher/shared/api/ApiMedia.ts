// 音楽・画像: ファイルの選択・登録・フォルダの走査(音楽プレーヤー・画像ビューア用)
// `api`(ApiModel.ts)に、他の領域といっしょに、まとめて渡される。

import { invoke, isTauri } from "./ApiHelpers";
import { mockImages, mockToneUrl, toImageEntry } from "./ApiMock";
import { type ImageEntry, type MusicTrack } from "./ApiTypes";

/** 音楽・画像: ファイルの選択・登録・フォルダの走査(音楽プレーヤー・画像ビューア用) */
export const mediaApi = {
  /**
   * 音声ファイルを選ぶダイアログ(複数選べる)。
   * @returns 選んだパス(キャンセルなら空)
   */
  async pickAudioFiles(): Promise<string[]> {
    if (!isTauri) return ["mock/Tone A.wav", "mock/Tone B.wav", "mock/Tone C.wav"];
    const { open } = await import("@tauri-apps/plugin-dialog");
    const r = await open({
      directory: false,
      multiple: true,
      filters: [{ name: "Audio", extensions: ["mp3", "flac", "wav", "ogg", "oga", "opus", "m4a", "aac", "weba"] }],
    });
    return Array.isArray(r) ? r : typeof r === "string" ? [r] : [];
  },
  /**
   * 音声ファイルを登録して、再生できる形(`url` つき)にする。音声でないもの・無いものは除かれる。
   * @param paths 音声ファイルのパス
   */
  async musicRegister(paths: string[]): Promise<MusicTrack[]> {
    if (!isTauri)
      return paths.map((p, i) => ({
        name: (p.split("/").pop() ?? p).replace(/\.[^.]*$/, ""),
        path: p,
        url: mockToneUrl(330 + (i % 3) * 110, 12),
      }));
    const r = await invoke<{ token: string; name: string; path: string }[]>("music_register", { paths });
    return r.map((t) => ({ name: t.name, path: t.path, url: `http://miniapp.localhost/__music/${t.token}` }));
  },
  /**
   * フォルダの中の音声ファイルを(サブフォルダも)探して登録する。
   * @param dir 探すフォルダ
   */
  async musicScanFolder(dir: string): Promise<MusicTrack[]> {
    if (!isTauri) return [];
    const r = await invoke<{ token: string; name: string; path: string }[]>("music_scan_folder", { dir });
    return r.map((t) => ({ name: t.name, path: t.path, url: `http://miniapp.localhost/__music/${t.token}` }));
  },
  /**
   * 画像ファイルを選ぶダイアログ(複数選べる)。
   * @returns 選んだパス
   */
  async pickImageFiles(): Promise<string[]> {
    if (!isTauri) return [];
    const { open } = await import("@tauri-apps/plugin-dialog");
    const r = await open({
      directory: false,
      multiple: true,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"] }],
    });
    return Array.isArray(r) ? r : typeof r === "string" ? [r] : [];
  },
  /**
   * 画像のフォルダを選ぶダイアログ。
   * @returns 選んだフォルダ。キャンセルなら `null`
   */
  async pickImageFolder(): Promise<string | null> {
    if (!isTauri) return "mock/photos";
    const { open } = await import("@tauri-apps/plugin-dialog");
    const r = await open({ directory: true, multiple: false });
    return typeof r === "string" ? r : null;
  },
  /**
   * 画像を登録して、表示できる形にする。
   * @param paths 画像のパス
   */
  async imageRegister(paths: string[]): Promise<ImageEntry[]> {
    if (!isTauri) return mockImages(paths.length);
    const r = await invoke<{ token: string; name: string; path: string }[]>("image_register", { paths });
    return r.map(toImageEntry);
  },
  /**
   * フォルダの中の画像を(サブフォルダも)探して登録する。
   * @param dir 探すフォルダ
   */
  async imageScanFolder(dir: string): Promise<ImageEntry[]> {
    if (!isTauri) return mockImages(14);
    const r = await invoke<{ token: string; name: string; path: string }[]>("image_scan_folder", { dir });
    return r.map(toImageEntry);
  },
};
