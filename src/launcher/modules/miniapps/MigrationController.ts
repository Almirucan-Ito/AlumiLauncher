import { appData } from "../../shared/api/AppDataModel";

/**
 * 以前の保存場所(設定ファイルの `widgetData`)にあった、ウィジェット・ミニアプリのデータを、それぞれのフォルダの `data` フォルダへ移す(アプリを更新した後の最初の起動で、一度だけ)。
 * 対象: ミニアプリの保存領域(`a_<名前>`)・ミュージックの曲とプレイリスト・タイマーの状態・画像ビューアの前回のフォルダ。
 * 以前の ToDo・付箋は、新しい形式が空のときだけ引き継ぐ(すでにあるデータは上書きしない)。壊れたデータは、移さない。
 * @param wd 以前の保存場所の内容(キー → JSON 文字列)
 * @returns 移したものがあれば `true`
 */
export async function migrateLegacyData(wd: Record<string, string>): Promise<boolean> {
  const keys = Object.keys(wd);
  if (keys.length === 0) return false;
  for (const k of keys) {
    const v = wd[k];
    if (typeof v !== "string") continue;
    if (k.startsWith("a_")) {
      // ミニアプリの保存領域: a_<ミニアプリ名> に、キーごとの JSON 文字列が入っていた
      try {
        const m = JSON.parse(v) as Record<string, unknown>;
        if (m && typeof m === "object")
          for (const [kk, vv] of Object.entries(m))
            if (typeof vv === "string") appData.set("miniapp", k.slice(2), kk, vv);
      } catch {
        /* 壊れていたら移さない */
      }
    } else if (k === "music" || k === "music_fav" || /^music_p\d$/.test(k)) {
      appData.set("miniapp", "music", k, v);
    } else if (k === "timer") {
      appData.set("widget", "timer", "state", v);
    } else if (k === "gallery_dir") {
      appData.set("miniapp", "gallery", "_lastdir", v);
    }
  }
  // 以前のウィジェットの ToDo(todo)・付箋(sticky)は、新しい形式が空のときだけ、引き継ぐ
  try {
    const planner = await appData.load("miniapp", "planner");
    if (!planner.tasks || planner.tasks === "[]") {
      const old = JSON.parse(wd.todo ?? "[]") as { t?: string; d?: boolean }[];
      const now = Date.now();
      const tasks = (Array.isArray(old) ? old : [])
        .filter((x) => x && typeof x.t === "string")
        .map((x, i) => ({ id: `m${now}${i}`, t: x.t as string, done: !!x.d, due: "", cat: "", ts: now + i }));
      if (tasks.length > 0) appData.set("miniapp", "planner", "tasks", JSON.stringify(tasks));
    }
    const memo = await appData.load("miniapp", "memo");
    if (!memo.stickies || memo.stickies === "[]") {
      const text = JSON.parse(wd.sticky ?? '""') as unknown;
      if (typeof text === "string" && text.trim())
        appData.set(
          "miniapp",
          "memo",
          "stickies",
          JSON.stringify([{ id: `m${Date.now()}`, text: text.slice(0, 1000), color: "#fde68a", ts: Date.now() }]),
        );
    }
  } catch {
    /* 壊れた古いデータは、移さない */
  }
  appData.flushAll();
  return true;
}
