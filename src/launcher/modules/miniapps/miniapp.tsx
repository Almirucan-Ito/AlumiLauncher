import { useEffect, useRef, useState } from "react";
import { alarms } from "./AlarmController";
import { appData } from "../../shared/api/AppDataModel";
import { api, miniAppLabel, miniAppUrl, type ImageEntry, type MiniApp } from "../../shared/api/ApiModel";
import { miniBridges } from "../plugins/PluginRegistry";
import { t } from "../../shared/i18n/i18n";
import { MiniAppIcon } from "./MiniAppPicker";

/** ミニアプリが保存できる値 1 つの大きさの上限(文字数)。 */
const STORAGE_VALUE_MAX = 32 * 1024;
/** ミニアプリが保存できる値の合計の大きさの上限(文字数。`_` で始まる、ランチャー専用のキーは数えない)。 */
const STORAGE_TOTAL_MAX = 60 * 1024;

/**
 * ミニアプリが、ランチャーの機能を使うための窓口(ホスト側の実装は `useMiniApps.ts`)。保存領域は、それぞれのフォルダの `data` / `cache` フォルダ。
 * 各機能は、ミニアプリの `miniapp.json` の `permissions` に書いたものだけが使える。
 */
export interface MiniEnv {
  /** メモなどの保存: ホームにテキストファイルを作る。戻り値は作ったファイルの名前 */
  saveText: (title: string, content: string) => Promise<string>;
  flash: (msg: string) => void;
  /** ホームのテキストファイル(.txt / .md)の一覧・読み込み・上書き(permissions に "files") */
  homeTexts: () => Promise<{ name: string; path: string }[]>;
  readText: (path: string) => Promise<string>;
  writeText: (path: string, content: string) => Promise<void>;
  /** ホームと、登録したフォルダの中のアイコンを、名前で探す・起動する(permissions に "launcher") */
  searchItems: (q: string) => Promise<{ name: string; path: string; where: string }[]>;
  launch: (path: string) => Promise<void>;
  /** 画像を選ぶ(permissions に "images")。last は、前回選んだフォルダ(前回の選び方は、`appId` のミニアプリごとに覚える) */
  pickImages: (appId: string, mode: "folder" | "files" | "last") => Promise<ImageEntry[]>;
}

/**
 * ミニアプリが使えるキー名か調べる。英数字と `_ - .` で 40 文字まで、先頭は英数字。`_` で始まるキーは、ランチャーだけが使う(ミニアプリからは書き換えられない)。
 * @param k 調べる値
 * @returns キー名として使えるなら `true`
 */
const validKey = (k: unknown): k is string => typeof k === "string" && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,39}$/.test(k);

/**
 * CSS の色の変数(`var(--text)` や `color-mix` など)を、ミニアプリへ渡せる実際の色(`rgb(...)`)にする。親の画面の変数は、そのままでは別の画面(iframe)で使えないため、いったん画面に置いて、計算された色を読む。
 * @param prop 色を入れるスタイルの種類(`color` か `backgroundColor`)
 * @param value CSS の色の指定(変数を含んでよい)
 * @returns 計算された色。画面の準備前は空文字
 */
function resolveColor(prop: "color" | "backgroundColor", value: string): string {
  const host = document.querySelector<HTMLElement>(".app");
  if (!host) return "";
  const probe = document.createElement("div");
  probe.style[prop] = value;
  probe.style.display = "none";
  host.appendChild(probe);
  const out = getComputedStyle(probe)[prop];
  probe.remove();
  return out;
}

/**
 * ミニアプリの画面。アプリ全体がこの画面になる(スマートフォンで、ほかのアプリを開いたときのよう)。
 * sandbox 付きの iframe で動かすので、ランチャーの機能には直接触れない。使える機能は、`miniapp.json` の `permissions` に書いたものだけで、postMessage の窓口から呼ぶ:
 *   ミニアプリ → ランチャー: `{ alumi: 1, id: <番号>, method: "saveText" | "storage.get" | ... | "close", params: {...} }`
 *   ランチャー → ミニアプリ: `{ alumi: 1, id: <同じ番号>, ok: true, result }` か `{ alumi: 1, id, ok: false, error }`
 *                            `{ alumi: 1, type: "theme", text, bg, dim, field, stroke }`(読み込み時)など
 * Web ミニアプリ(`url` を持つもの)は、iframe ではなく、別のウィンドウで開く(`WebPanel`)。
 * @param app 開くミニアプリ
 * @param env ランチャーの機能の窓口
 * @param onClose 閉じるとき
 */
export function MiniAppHost({ app, env, onClose }: { app: MiniApp; env: MiniEnv; onClose: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const envRef = useRef(env);
  envRef.current = env;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // ランチャー側の機能(ブリッジ)が、状態を送り続けるものは、開いている間つなぐ(例: 音楽プレーヤーの状態。permissions に、その権限があるときだけ)
  const bridgeLinks = useRef<{ push: (force?: boolean) => void }[]>([]);
  useEffect(() => {
    const post = (msg: Record<string, unknown>) => frame.current?.contentWindow?.postMessage({ alumi: 1, ...msg }, "*");
    const links = miniBridges
      .filter((b) => b.connect && app.permissions.includes(b.permission))
      .map((b) => b.connect!(post));
    bridgeLinks.current = links;
    return () => {
      links.forEach((l) => l.stop());
      bridgeLinks.current = [];
    };
  }, [app]);

  // アラームの時刻になったことを、ミニアプリへ知らせる(permissions に "alarm" があるときだけ)
  useEffect(() => {
    if (!app.permissions.includes("alarm")) return;
    const off = alarms.subscribe(
      (a) =>
        a.app === app.id && frame.current?.contentWindow?.postMessage({ alumi: 1, type: "alarm-fired", alarm: a }, "*"),
    );
    return () => void off();
  }, [app]);

  useEffect(() => {
    const onMessage = async (e: MessageEvent) => {
      const win = frame.current?.contentWindow;
      if (!win || e.source !== win) return; // このミニアプリの画面からのメッセージだけ
      const d = e.data;
      if (!d || d.alumi !== 1 || typeof d.id !== "number" || typeof d.method !== "string") return;
      const reply = (ok: boolean, result?: unknown, error?: string) =>
        win.postMessage({ alumi: 1, id: d.id, ok, result, error }, "*");
      const p = d.params && typeof d.params === "object" ? d.params : {};
      const allowed = (perm: string) => app.permissions.includes(perm);
      const env = envRef.current;
      try {
        switch (d.method) {
          case "close":
            closeRef.current();
            return reply(true);
          case "home.texts":
            if (!allowed("files")) return reply(false, undefined, "permission");
            return reply(true, await env.homeTexts());
          case "home.read":
            if (!allowed("files") || typeof p.path !== "string") return reply(false, undefined, "permission");
            return reply(true, await env.readText(p.path));
          case "home.write":
            if (!allowed("files") || typeof p.path !== "string" || typeof p.content !== "string")
              return reply(false, undefined, "permission");
            await env.writeText(p.path, p.content);
            return reply(true);
          case "launcher.search":
            if (!allowed("launcher") || typeof p.q !== "string") return reply(false, undefined, "permission");
            return reply(true, await env.searchItems(p.q.slice(0, 100)));
          case "launcher.launch":
            if (!allowed("launcher") || typeof p.path !== "string") return reply(false, undefined, "permission");
            await env.launch(p.path);
            return reply(true);
          case "images.pick": {
            if (!allowed("images")) return reply(false, undefined, "permission");
            const mode = p.mode === "files" ? "files" : p.mode === "last" ? "last" : "folder";
            return reply(true, await env.pickImages(app.id, mode));
          }
          case "alarm.set":
            if (!allowed("alarm") || typeof p.id !== "string" || typeof p.at !== "number")
              return reply(false, undefined, "permission");
            alarms.set(app.id, {
              id: p.id,
              at: p.at,
              label: String(p.label ?? ""),
              kind: String(p.kind ?? ""),
              minutes: Number(p.minutes) || 0,
            });
            return reply(true);
          case "alarm.cancel":
            if (!allowed("alarm") || typeof p.id !== "string") return reply(false, undefined, "permission");
            alarms.cancel(app.id, p.id);
            return reply(true);
          case "alarm.list":
            if (!allowed("alarm")) return reply(false, undefined, "permission");
            return reply(
              true,
              alarms.pending(app.id).map(({ app: _a, ...a }) => a),
            );
          case "alarm.collect":
            if (!allowed("alarm")) return reply(false, undefined, "permission");
            return reply(true, alarms.collect(app.id));
          case "toast":
            if (typeof p.message === "string") env.flash(p.message.slice(0, 200));
            return reply(true);
          case "saveText": {
            if (!allowed("saveText")) return reply(false, undefined, "permission");
            if (typeof p.content !== "string" || p.content.length > 1024 * 1024)
              return reply(false, undefined, "invalid");
            const name = await env.saveText(typeof p.title === "string" ? p.title : "", p.content);
            return reply(true, { name });
          }
          case "storage.get": {
            if (!allowed("storage")) return reply(false, undefined, "permission");
            if (!validKey(p.key)) return reply(true, null);
            return reply(true, (await appData.read("miniapp", app.id, p.key)) ?? null);
          }
          case "storage.set": {
            if (!allowed("storage")) return reply(false, undefined, "permission");
            if (!validKey(p.key) || typeof p.value !== "string" || p.value.length > STORAGE_VALUE_MAX)
              return reply(false, undefined, "invalid");
            const cur = await appData.load("miniapp", app.id);
            const total = Object.entries(cur).reduce(
              (n, [k, v]) => (k === p.key || k.startsWith("_") ? n : n + v.length),
              0,
            );
            if (total + p.value.length > STORAGE_TOTAL_MAX) return reply(false, undefined, "too large");
            appData.set("miniapp", app.id, p.key, p.value);
            return reply(true);
          }
          case "cache.get": {
            if (!allowed("storage")) return reply(false, undefined, "permission");
            return reply(true, validKey(p.key) ? await api.appCacheGet("miniapp", app.id, p.key) : null);
          }
          case "cache.set": {
            if (!allowed("storage")) return reply(false, undefined, "permission");
            if (!validKey(p.key) || typeof p.value !== "string" || p.value.length > STORAGE_VALUE_MAX)
              return reply(false, undefined, "invalid");
            await api.appCacheSet("miniapp", app.id, p.key, p.value);
            return reply(true);
          }
          default: {
            // ランチャー側の機能(ブリッジ。例: player.*)
            const bridge = miniBridges.find((b) => d.method.startsWith(b.prefix));
            if (!bridge) return reply(false, undefined, "unknown method");
            if (!allowed(bridge.permission)) return reply(false, undefined, "permission");
            return reply(true, await bridge.handle(d.method, p));
          }
        }
      } catch (err) {
        reply(false, undefined, String(err));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [app]);

  const sendTheme = () => {
    const win = frame.current?.contentWindow;
    const host = document.querySelector<HTMLElement>(".app");
    if (!win || !host) return;
    const css = getComputedStyle(host);
    win.postMessage(
      {
        alumi: 1,
        type: "theme",
        text: resolveColor("color", "var(--text)"),
        bg: resolveColor("backgroundColor", css.getPropertyValue("--sheet-bg") || "var(--sheet-bg)"),
        dim: resolveColor("color", "var(--text-dim)"),
        field: resolveColor("backgroundColor", "var(--field)"),
        stroke: resolveColor("color", "var(--stroke)"),
        lang: navigator.language,
      },
      "*",
    );
    bridgeLinks.current.forEach((l) => l.push(true));
  };

  return (
    <div
      className="mini-mode"
      onContextMenu={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="mini-bar" data-tauri-drag-region>
        <button className="mini-back" onClick={onClose} title={t("miniBack")}>
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 5l-7 7 7 7" />
          </svg>
          <span>{t("miniBack")}</span>
        </button>
        <span className="mini-name">{miniAppLabel(app)}</span>
      </div>
      {app.url ? (
        <WebPanel app={app} onClose={onClose} />
      ) : (
        <iframe
          ref={frame}
          className="mini-frame"
          title={miniAppLabel(app)}
          // ブラウザでの動作確認(開発用の画面)では、同じ場所のファイルが読み込めないため allow-same-origin を足す。アプリ本体(miniapp プロトコル)では付けない
          sandbox={
            miniAppUrl(app.id, app.entry).startsWith("/")
              ? "allow-scripts allow-forms allow-same-origin"
              : "allow-scripts allow-forms"
          }
          referrerPolicy="no-referrer"
          src={miniAppUrl(app.id, app.entry)}
          onLoad={sendTheme}
        />
      )}
    </div>
  );
}

/**
 * Web ミニアプリ(`miniapp.json` の `url`)の画面。サイトは、ランチャーと同じ位置・大きさの別のウィンドウ(バックエンドが作る)で開く。
 * ここには、開いている間の案内と、閉じるボタンを出す。そのウィンドウを閉じたら、このミニアプリも閉じる(自分で閉じるときの通知は無視する)。
 * @param app 開く Web ミニアプリ
 * @param onClose 閉じるとき
 */
function WebPanel({ app, onClose }: { app: MiniApp; onClose: () => void }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const state = useRef<"opening" | "open" | "failed">("opening");
  const [error, setError] = useState("");
  useEffect(() => {
    let off: (() => void) | undefined;
    let dead = false;
    api.onMiniWebClosed(() => state.current === "open" && closeRef.current()).then((fn) => (dead ? fn() : (off = fn)));
    api
      .miniWebOpen(app.id)
      .then(() => (state.current = "open"))
      .catch((err) => {
        state.current = "failed";
        setError(String(err));
      });
    return () => {
      dead = true;
      off?.();
      state.current = "failed"; // 自分で閉じるときの通知は無視する
      api.miniWebClose();
    };
  }, [app.id]);
  return (
    <div className="mini-web">
      <div className="mini-web-card">
        <MiniAppIcon app={app} size={56} />
        <div className="mini-web-title">{t("miniWebOpened", { name: miniAppLabel(app) })}</div>
        {error ? (
          <div className="hint mini-web-error">
            {t("miniWebFailed")}: {error}
          </div>
        ) : (
          <div className="hint">{t("miniWebHint")}</div>
        )}
        <button className="small danger-btn" onClick={onClose}>
          {t("miniWebClose")}
        </button>
      </div>
    </div>
  );
}
