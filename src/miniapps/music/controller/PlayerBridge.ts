import { api } from "../../../launcher/shared/api/ApiModel";
import type { MiniBridge } from "../../../launcher/modules/plugins/PluginModel";
import { player, type Repeat } from "./PlayerController";

/**
 * ミニアプリ(権限 `player`)から来た、音楽プレーヤーへの操作を実行する。値の型は、ここで検査する(数値でなければ無視する)。
 * @param cmd 命令の名前(`play` / `pause` / `toggle` / `next` / `prev` / `seek` / `volume` / `mute` / `shuffle` / `repeat` / `rate` / `remove` / `move` / `clear` / `fav` / `list.*` / `copy` / `sleep` / `addFiles` / `addFolder`)
 * @param a 命令に付く値(`index`・`sec`・`value` など)
 * @throws 知らない命令のとき
 */
async function playerCommand(cmd: unknown, a: Record<string, unknown>) {
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  switch (cmd) {
    case "play": {
      const i = num(a.index);
      return player.play(i === null ? undefined : i);
    }
    case "pause":
      return player.pause();
    case "toggle":
      return player.toggle();
    case "next":
      return player.next();
    case "prev":
      return player.prev();
    case "seek":
      return num(a.sec) !== null && player.seek(a.sec as number);
    case "volume":
      return num(a.value) !== null && player.setVolume(a.value as number);
    case "mute":
      return player.setMuted(!!a.value);
    case "shuffle":
      return player.setShuffle(!!a.value);
    case "repeat":
      return (a.value === "off" || a.value === "all" || a.value === "one") && player.setRepeat(a.value as Repeat);
    case "rate":
      return num(a.value) !== null && player.setRate(a.value as number);
    case "remove":
      return num(a.index) !== null && player.remove(a.index as number);
    case "move":
      return num(a.from) !== null && num(a.to) !== null && player.move(a.from as number, a.to as number);
    case "clear":
      return player.clear();
    case "fav":
      return player.toggleFavorite(num(a.index) ?? undefined);
    case "list.new":
      return player.newList(typeof a.name === "string" ? a.name : undefined);
    case "list.rename":
      return num(a.index) !== null && typeof a.name === "string" && player.renameList(a.index as number, a.name);
    case "list.delete":
      return num(a.index) !== null && player.deleteList(a.index as number);
    case "list.select":
      return num(a.index) !== null && player.selectList(a.index as number);
    case "copy":
      return num(a.index) !== null && num(a.to) !== null && player.copyTrack(a.index as number, a.to as number);
    case "sleep":
      return player.setSleep(num(a.minutes));
    case "addFiles":
      return player.add(await api.musicRegister(await api.pickAudioFiles()));
    case "addFolder": {
      const dir = await api.pickFolder();
      return dir ? player.add(await api.musicScanFolder(dir)) : undefined;
    }
    default:
      throw new Error("unknown command");
  }
}

/** ミニアプリ(権限 `player`)が呼べる、音楽プレーヤーの機能。`player.state`(状態と曲の一覧を返す)と `player.cmd`(操作)。開いている間は、状態を送り続ける(曲の一覧は、変わったときだけ)。 */
export const playerBridge: MiniBridge = {
  permission: "player",
  prefix: "player.",
  async handle(method, params) {
    if (method === "player.state") return { state: player.getState(), tracks: player.trackInfo() };
    if (method === "player.cmd") {
      await playerCommand(
        params.cmd,
        params.args && typeof params.args === "object" ? (params.args as Record<string, unknown>) : {},
      );
      return undefined;
    }
    throw new Error("unknown method");
  },
  connect(post) {
    let sentVersion = -1;
    const push = (force = false) => {
      if (force) sentVersion = -1;
      const st = player.getState();
      post({ type: "player", state: st });
      if (st.tracksVersion !== sentVersion) {
        sentVersion = st.tracksVersion;
        post({ type: "player-tracks", tracks: player.trackInfo() });
      }
    };
    const off = player.subscribe(() => push());
    return { push, stop: off };
  },
};
