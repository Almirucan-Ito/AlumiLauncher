// 画面から Rust 側を呼ぶ窓口(`api`)。領域ごとのファイル(ApiApp / ApiWindow / ApiFiles / ApiExtensions / ApiMedia)を、1 つにまとめる。
// 呼ぶ側は、これまでどおり `api.○○()` と書く。ブラウザでの見た目の確認用に、Tauri の外ではダミーの値を返す(ダミーは ApiMock.ts)。
import { appApi } from "./ApiApp";
import { windowApi } from "./ApiWindow";
import { filesApi } from "./ApiFiles";
import { extensionsApi } from "./ApiExtensions";
import { mediaApi } from "./ApiMedia";

// 型・補助は、これまでどおり、このファイルから読み込める
export * from "./ApiTypes";
export * from "./ApiHelpers";

/** 画面から、Rust 側のコマンド(と、ダイアログ・ウィンドウ操作)を呼ぶ窓口。 */
export const api = {
  ...appApi,
  ...windowApi,
  ...filesApi,
  ...extensionsApi,
  ...mediaApi,
};
