import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import {
  type Config,
  DEFAULT_SETTINGS,
  type Item,
  type MiniApp,
  api,
  miniAppLabel,
  miniConsentKey,
} from "../../shared/api/ApiModel";
import { appData } from "../../shared/api/AppDataModel";
import { beep } from "../../shared/audio/BeepController";
import { t } from "../../shared/i18n/i18n";
import { fileLabel } from "../../shared/lib/PathUtil";
import { HOME_ORDER_KEY, type HomeEntry, entryKey } from "../home/HomeModel";
import { fetchItems } from "../icons/IconController";
import { type ConsentRequest } from "../shell/ConsentDialog";
import { alarms } from "./AlarmController";
import { type MiniEnv } from "./miniapp";

/**
 * ミニアプリを開く・一覧を読む・ランチャーの機能を貸す(`MiniEnv`)・外部との通信の同意を聞く、をまとめる。
 *
 * @param configRef 常に最新の設定
 * @param mutate 最新の設定に変更を適用して保存する関数
 * @param flash 画面に一言出す関数
 * @param launcherRef ホームのアイコンの保存先(launcherFolder)のパス
 * @param setLauncherPath ホームのアイコンの保存先のパスを変える関数
 * @param bumpFolder そのフォルダの一覧を取り直させる関数
 * @param entriesRef いまのホームの並び
 * @returns 状態(`miniOpen`・`minis`・`consent`)と、操作
 */
export function useMiniApps({
  configRef,
  mutate,
  flash,
  launcherRef,
  setLauncherPath,
  bumpFolder,
  entriesRef,
}: {
  configRef: MutableRefObject<Config | null>;
  mutate: (fn: (c: Config) => Config) => Promise<void> | undefined;
  flash: (msg: string) => void;
  launcherRef: MutableRefObject<string>;
  setLauncherPath: (path: string) => void;
  bumpFolder: (path: string) => void;
  entriesRef: MutableRefObject<HomeEntry[]>;
}) {
  /** いま開いているミニアプリ。 */
  const [miniOpen, setMiniOpen] = useState<MiniApp | null>(null);
  /** ミニアプリの一覧。 */
  const [minis, setMinis] = useState<MiniApp[]>([]);
  /** 一覧を、一度でも読めたか(読む前の空の一覧と、本当に無いときを、区別する)。 */
  const [minisLoaded, setMinisLoaded] = useState(false);
  /** ミニアプリの一覧の画面を開いているか。 */
  const [pickingMini, setPickingMini] = useState(false);
  /** 外部のサーバーと通信するもの(ウィジェット・ミニアプリ)を、初めて使うときの確認。同意すると、次からは確認しない。 */
  const [consent, setConsent] = useState<ConsentRequest | null>(null);

  /**
   * 外部との通信に同意したことを、設定(`networkAllowed`)に記録する。
   * @param key 同意の記録のキー(`widget:...` / `miniapp:...`)
   * @returns 保存が Rust 側に届くまで待つための約束
   */
  const allowNetwork = (key: string) =>
    mutate((c) => ({
      ...c,
      settings: {
        ...DEFAULT_SETTINGS,
        ...c.settings,
        networkAllowed: [...new Set([...(c.settings?.networkAllowed ?? []), key])],
      },
    }));

  /**
   * 同意の確認で、「同意する」が押された。記録してから、続きの操作(ミニアプリを開く、など)を行う。
   * @param c 確認していた内容
   */
  const confirmConsent = (c: ConsentRequest) => {
    const after = c.after;
    setConsent(null);
    // 同意の保存が Rust 側に届いてから開く(先に開く要求が届くと、同意がまだ無いとして、`not_allowed` で開けない)
    const saved = allowNetwork(c.key);
    (saved ?? Promise.resolve()).catch(() => {}).finally(() => after?.());
  };

  /**
   * ミニアプリを開く。通信するもので、まだ同意していなければ、確認のダイアログを出して、同意されたら開く。
   * @param a 開くミニアプリ
   */
  const openMini = (a: MiniApp) => {
    const key = miniConsentKey(a.id);
    if (a.network && !(configRef.current?.settings?.networkAllowed ?? []).includes(key))
      setConsent({ name: miniAppLabel(a), key, web: !!a.url, after: () => setMiniOpen(a) });
    else setMiniOpen(a);
  };
  const openMiniRef = useRef(openMini);
  openMiniRef.current = openMini;

  /**
   * ミニアプリの一覧を読み直す。
   * @returns 一覧(失敗したら空)
   */
  const refreshMinis = useCallback(
    () =>
      api
        .listMiniApps()
        .then((r) => (setMinis(r), setMinisLoaded(true), r))
        .catch(() => [] as MiniApp[]),
    [],
  );
  // 起動時にも読む(ショートカットウィジェットが、無くなったミニアプリを外すため)
  useEffect(() => {
    void refreshMinis();
  }, [refreshMinis]);

  /**
   * ホームに作ったファイルのアイコンを、ホームの一番後ろに置く。いまの並びを保存してから、最後に足すので、ほかのアイコンが後ろに回り込まない(並びに無いものは、一覧の順で入ってしまうため、順を決めておく)。
   * @param path 作ったファイルのパス
   * @returns ホームのアイコンの保存先(launcherFolder)のパス
   */
  const placeLastOnHome = async (path: string): Promise<string> => {
    const home = launcherRef.current || (await api.getLauncherFolder());
    setLauncherPath(home);
    const key = `i:${path}`;
    const keys = entriesRef.current
      .filter((e) => e.kind !== "slot")
      .map(entryKey)
      .filter((k) => k !== key);
    mutate((c) => ({ ...c, orders: { ...c.orders, [HOME_ORDER_KEY]: [...keys, key] } }));
    return home;
  };

  /**
   * ミニアプリの「テキストを保存」: ホームにテキストファイルを作る。書き出したテキストのアイコンは、ホームの一番後ろに置く。
   * @param title ファイル名(拡張子は自動で付く)
   * @param body 中身
   * @returns 作ったファイルの名前
   */
  const saveTextForMini = async (title: string, body: string): Promise<string> => {
    const path = await api.createTextFile(title, body, t("newTextName"));
    bumpFolder(await placeLastOnHome(path));
    return fileLabel(path);
  };

  /**
   * ホームに、ミニアプリのアイコン(`.alumiapp`)を作る。ホームの一番後ろに置く。
   * @param a 対象のミニアプリ
   */
  const addMiniToHome = async (a: MiniApp) => {
    try {
      const path = await api.createMiniAppShortcut(a.id, miniAppLabel(a));
      bumpFolder(await placeLastOnHome(path));
      flash(t("memoSaved", { name: miniAppLabel(a) }));
    } catch (err) {
      flash(t("failed", { err: String(err) }));
    }
  };

  // ホームのミニアプリのアイコン(.alumiapp)を押したとき・ウィジェットなどから、名前(フォルダ名)を指定して開くとき
  useEffect(() => {
    const onOpenMini = async (e: Event) => {
      const path = (e as CustomEvent<string>).detail;
      try {
        const id = await api.miniAppOfFile(path);
        const list = await refreshMinis();
        const app = list.find((a) => a.id === id);
        if (app) openMiniRef.current(app);
        else flash(t("miniNotFound"));
      } catch {
        flash(t("miniNotFound"));
      }
    };
    const onOpenMiniId = async (e: Event) => {
      const list = await refreshMinis();
      const app = list.find((a) => a.id === (e as CustomEvent<string>).detail);
      if (app) openMiniRef.current(app);
      else flash(t("miniNotFound"));
    };
    window.addEventListener("alumi:open-miniapp", onOpenMini);
    window.addEventListener("alumi:open-miniapp-id", onOpenMiniId);
    return () => {
      window.removeEventListener("alumi:open-miniapp", onOpenMini);
      window.removeEventListener("alumi:open-miniapp-id", onOpenMiniId);
    };
  }, [refreshMinis, flash]);

  // アラーム: 時刻になったら、音と画面で知らせる(ミニアプリを閉じていても)。保存と、起動時の復元
  useEffect(() => {
    alarms.configure(
      (app, json) => appData.set("miniapp", app, "_alarms", json),
      (a) => {
        flash(`⏰ ${a.label || t("alarmDone")}`);
        beep();
        api.bringToFront();
      },
    );
  }, [flash]);

  /**
   * (ミニアプリ用)ホームと、登録したフォルダの中のアイコンを、名前で探す(300 件まで)。
   * @param qs 探す文字
   * @returns 名前・パス・見つけた場所の一覧
   */
  const searchItems = async (qs: string) => {
    const needle = qs.trim().toLowerCase();
    if (!needle) return [];
    const out: { name: string; path: string; where: string }[] = [];
    const add = (items: Item[], where: string) => {
      for (const it of items)
        if (out.length < 300 && it.name.toLowerCase().includes(needle))
          out.push({ name: it.name, path: it.path, where });
    };
    const home = launcherRef.current || (await api.getLauncherFolder());
    add(await fetchItems(home).catch(() => []), t("miniBack"));
    for (const f of configRef.current?.folders ?? []) add(await fetchItems(f.path).catch(() => []), f.name);
    return out;
  };

  /** ミニアプリが、ランチャーの機能を使うための窓口(`MiniEnv`)の実装。画像の選び方(フォルダ / ファイル)は、ランチャーが覚えて、次回の「前回」に使う(`_` で始まるキーは、ミニアプリが書き換えられない)。 */
  const miniEnv: MiniEnv = {
    saveText: saveTextForMini,
    flash,
    homeTexts: async () => (await api.listHomeTexts()).map((i) => ({ name: i.name, path: i.path })),
    readText: (p) => api.readTextFile(p),
    writeText: (p, c) => api.writeTextFile(p, c),
    searchItems,
    launch: (p) => api.launch(p),
    pickImages: async (appId, mode) => {
      // 前回の選び方(フォルダ / ファイル)は、ランチャーが覚える(_ で始まるキーは、ミニアプリが書き換えられない)
      const remember = (k: string, v: string) => appData.set("miniapp", appId, k, v);
      const openFiles = async (paths: string[]) => {
        const got = await api.imageRegister(paths);
        const json = JSON.stringify(got.map((g) => g.path).slice(0, 300));
        if (got.length > 0 && json.length < 60_000) {
          remember("_lastfiles", json);
          remember("_lastkind", "files");
        }
        return got;
      };
      if (mode === "files") return openFiles(await api.pickImageFiles());
      if (mode === "last" && (await appData.read("miniapp", appId, "_lastkind")) === "files") {
        try {
          const saved = JSON.parse((await appData.read("miniapp", appId, "_lastfiles")) ?? "[]");
          return Array.isArray(saved) ? api.imageRegister(saved.filter((p) => typeof p === "string")) : [];
        } catch {
          return [];
        }
      }
      const dir = mode === "last" ? await appData.read("miniapp", appId, "_lastdir") : await api.pickImageFolder();
      if (!dir) return [];
      if (mode === "folder") {
        remember("_lastdir", dir);
        remember("_lastkind", "folder");
      }
      return api.imageScanFolder(dir);
    },
  };

  return {
    miniOpen,
    setMiniOpen,
    minis,
    minisLoaded,
    refreshMinis,
    pickingMini,
    setPickingMini,
    consent,
    setConsent,
    confirmConsent,
    openMini,
    addMiniToHome,
    miniEnv,
  };
}
