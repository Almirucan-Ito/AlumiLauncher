import { pad2 } from "../../../launcher/shared/lib/FormatUtil";
import { appData } from "../../../launcher/shared/api/AppDataModel";

/** ミニアプリ「予定とToDo」の ToDo 1 件(`due` は期限 `YYYY-MM-DD`、`cat` はカテゴリ、`ts` は作成時刻、`doneAt` は完了時刻)。 */
export type PlanTask = { id: string; t: string; done: boolean; due: string; cat: string; ts: number; doneAt?: number };
/** ミニアプリ「予定とToDo」の予定 1 件(`date` は `YYYY-MM-DD`)。 */
export type PlanEvent = { id: string; date: string; t: string; note: string };

/** データを預けているミニアプリ(予定とToDo)のフォルダ名。 */
export const PLANNER_APP = "planner";

/**
 * JSON の配列として保存されたデータ(ミニアプリのフォルダの `data` に、キーごとに入っている)を読む。
 * @param raw 保存されていた文字列
 * @returns 配列。無い・壊れている・配列でないときは空
 */
export function parseList<T>(raw: string | undefined): T[] {
  try {
    const v = JSON.parse(raw ?? "[]");
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

/**
 * 配列を JSON にして、ミニアプリのデータとして保存する。
 * @param app ミニアプリのフォルダ名
 * @param key キー名
 * @param value 保存する配列
 */
export const writeList = (app: string, key: string, value: unknown) =>
  appData.set("miniapp", app, key, JSON.stringify(value));

/**
 * 日付を `YYYY-MM-DD` の文字列にする(ローカル時刻)。
 * @param d 日付
 */
export const ymdOf = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
