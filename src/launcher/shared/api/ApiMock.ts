/** ブラウザ(Tauri の外)で、見た目だけを確認するための、ダミーのデータと関数。`api` が、Tauri の外では、これを返す。 */
import { type StartApp, type ModWidget, type MiniApp, type ImageEntry, type Config } from "./ApiTypes";

/** ブラウザ確認用の、スタートメニューのアプリ。 */
export const MOCK_START_APPS: StartApp[] = ["Calculator", "Notepad", "Paint", "Microsoft Edge", "Microsoft Store"].map(
  (name) => ({
    name,
    id: `mock:${name}`,
  }),
);

/** `miniapp.json` / `widget.json` の中身(モックの元データ。ブラウザだけで動かすとき、フォルダの JSON をそのまま使う)。 */
type RawManifest = Record<string, unknown>;
const rawMini = import.meta.glob<RawManifest>("../../../miniapps/*/miniapp.json", { eager: true, import: "default" });
const rawWidgets = import.meta.glob<RawManifest>("../../../widgets/*/widget.json", { eager: true, import: "default" });
const rawMiniWidgets = import.meta.glob<RawManifest>("../../../miniapps/*/widgets/*/widget.json", {
  eager: true,
  import: "default",
});
/**
 * ファイルのパスから、フォルダ名を取り出す。
 * @param path `.../miniapps/<id>/...` のようなパス
 * @param root `"miniapps"` か `"widgets"`
 */
const folderOf = (path: string, root: string) => path.split(`/${root}/`)[1].split("/")[0];

/** ブラウザ確認用のミニアプリの一覧(`src/miniapps` の各フォルダの `miniapp.json` から作る)。 */
export function mockMiniApps(): MiniApp[] {
  return Object.entries(rawMini).map(([path, m]) => ({
    id: folderOf(path, "miniapps"),
    name: String(m.name ?? ""),
    description: String(m.description ?? ""),
    nameEn: String(m.name_en ?? ""),
    descriptionEn: String(m.description_en ?? ""),
    entry: String(m.entry || "index.html"),
    icon: String(m.icon ?? ""),
    permissions: (m.permissions as string[] | undefined) ?? [],
    url: String(m.url ?? ""),
    network: !!m.network,
  }));
}

/** ブラウザ確認用のウィジェットの一覧(`src/widgets` と、ミニアプリの中の `widgets` の、各フォルダの `widget.json` から作る)。 */
export function mockWidgets(): ModWidget[] {
  const minis = mockMiniApps();
  const make = (m: RawManifest, id: string, kind: "mod" | "mini", app: string): ModWidget => ({
    id,
    name: String(m.name ?? id),
    nameEn: String(m.name_en ?? ""),
    description: String(m.description ?? ""),
    descriptionEn: String(m.description_en ?? m.description ?? ""),
    entry: String(m.entry || "index.html"),
    icon: String(m.icon ?? ""),
    width: Number(m.width) || 160,
    height: Number(m.height) || 60,
    builtin: String(m.builtin ?? ""),
    cells: (m.cells as [number, number, number] | undefined) ?? [0, 0, 0],
    kind,
    app,
    appName: minis.find((x) => x.id === app)?.name ?? "",
    appNameEn: minis.find((x) => x.id === app)?.nameEn ?? "",
    dataApp: String(m.data_app ?? ""),
    network: !!m.network,
  });
  const mods = Object.entries(rawWidgets).map(([p, m]) => make(m, folderOf(p, "widgets"), "mod", ""));
  const inMinis = Object.entries(rawMiniWidgets).map(([p, m]) =>
    make(m, p.split("/widgets/")[1].split("/")[0], "mini", folderOf(p, "miniapps")),
  );
  return [...mods, ...inMinis];
}

// ---- ブラウザ(Tauri外)で見た目だけ確認するためのモック ----
/** ここから `MOCK_CONFIG` までは、ブラウザ(Tauri の外)で、見た目だけを確認するためのダミーのデータと関数。 */
export const mockTexts: Record<string, string> = {};
export const mockStore: Record<string, Record<string, string>> = {};
export const mockCache: Record<string, string> = {};
export const toImageEntry = (t: { token: string; name: string; path: string }): ImageEntry => ({
  name: t.name,
  path: t.path,
  url: `http://miniapp.localhost/__img/${t.token}`,
  thumb: `http://miniapp.localhost/__thumb/${t.token}`,
});
/**
 * 動作確認用の、色つきの画像(SVG の data URL)を作る。
 * @param n 枚数
 */
export function mockImages(n: number): ImageEntry[] {
  return Array.from({ length: n }, (_, i) => {
    const h = (i * 47) % 360;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420"><rect width="640" height="420" fill="hsl(${h},60%,48%)"/><text x="320" y="230" font-size="120" text-anchor="middle" fill="white" font-family="sans-serif">${i + 1}</text></svg>`;
    const url = "data:image/svg+xml;utf8," + encodeURIComponent(svg);
    return { name: `写真 ${i + 1}.svg`, path: `mock/photos/${i + 1}.svg`, url, thumb: url };
  });
}
/**
 * 動作確認用の、ピーという音の WAV(blob の URL)を作る。
 * @param freq 周波数(Hz)
 * @param secs 長さ(秒)
 */
export function mockToneUrl(freq: number, secs: number): string {
  const rate = 8000;
  const n = rate * secs;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  v.setUint32(4, 36 + n * 2, true);
  w(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin((2 * Math.PI * freq * i) / rate) * 3000, true);
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}
/** 起動の記録(新しい順)。`api.launch` が足し、`api.listUsage` が読む。 */
export const mockState = { usage: [] as string[] };
export const mockMiniFiles: Record<string, string> = {};
export const mockCounts: Record<string, number> = {};
export const MOCK_NAMES: Record<string, string[]> = {
  "mock/launcherFolder": ["Google Chrome", "Discord"],
  "mock/work": [
    "Word",
    "Excel",
    "PowerPoint",
    "Outlook",
    "OneNote",
    "Teams",
    "Slack",
    "Notion",
    "Zoom",
    "Figma",
    "Visual Studio Code",
    "Terminal",
    "GitHub Desktop",
    "Postman",
    "Docker",
  ],
  "mock/game": ["Steam", "VRChat", "Discord", "Epic Games", "Unity Hub", "OBS Studio", "Spotify", "Blender"],
  "mock/tools": [
    "電卓",
    "メモ帳",
    "ペイント",
    "Snipping Tool",
    "エクスプローラー",
    "設定",
    "7-Zip",
    "Everything",
    "PowerToys",
    "WinMerge",
    "Notepad++",
    "VLC",
    "Git Bash",
    "PuTTY",
    "TreeSize",
    "CCleaner",
    "Chrome",
    "Firefox",
    "Edge",
    "Brave",
    "Obsidian",
    "Bitwarden",
    "Paint.NET",
    "GIMP",
    "Audacity",
    "HandBrake",
    "FileZilla",
    "WinSCP",
  ],
};
export const MOCK_CONFIG: Config = {
  folders: [
    { id: "1", name: "仕事", path: "mock/work" },
    { id: "2", name: "ゲーム", path: "mock/game" },
    { id: "3", name: "ツール", path: "mock/tools" },
  ],
};

/** 背景画像の URL(Blob)。新しく作るときに、前のものを解放する(メモリが増え続けないように)。 */
let bgUrl: string | null = null;
/**
 * 画像のバイト列から、表示用の URL を作る(前の背景画像の URL は解放する)。
 * @param buf 画像のバイト列
 */
export function blobUrl(buf: ArrayBuffer): string {
  if (bgUrl) URL.revokeObjectURL(bgUrl);
  bgUrl = URL.createObjectURL(new Blob([buf]));
  return bgUrl;
}
