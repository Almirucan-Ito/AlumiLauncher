import { appData } from "../../launcher/shared/api/AppDataModel";
import { definePlugin } from "../../launcher/modules/plugins/PluginModel";
import { player } from "./controller/PlayerController";
import { playerBridge } from "./controller/PlayerBridge";
import { MusicWidget } from "./view/MusicWidget";
import widget from "./widgets/music/widget.json";

/** 曲の一覧・設定は、このミニアプリのフォルダの data に保存する(プレーヤー本体は、ランチャーの画面側に 1 つだけあり、ミニアプリを閉じても再生が続く) */
player.setPersist((entries) => {
  for (const [k, v] of Object.entries(entries)) appData.set("miniapp", "music", k, v);
});

/** ミニアプリ「ミュージック」の、ランチャー側の部分(音楽プレーヤーの本体・ウィジェット・ミニアプリへの窓口)。 */
export default definePlugin({
  widgets: {
    music: { component: MusicWidget, cells: widget.cells as [number, number, number] },
  },
  bridges: [playerBridge],
  hooks: {
    onMasterVolume: (v) => player.setMaster(v),
    onStart: async () => {
      const music = await appData.load("miniapp", "music");
      await player.restore((k) => music[k]);
    },
    onDataCleared: (target) => {
      if (!target || target.id === "music") player.reset();
    },
  },
});
