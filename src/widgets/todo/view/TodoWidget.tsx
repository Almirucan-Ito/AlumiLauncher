import "./style.css";
import { useState } from "react";
import { useAppData } from "../../../launcher/shared/api/AppDataModel";
import { t } from "../i18n";
import { PLANNER_APP, parseList, writeList, ymdOf, type PlanEvent, type PlanTask } from "../model/TodoModel";

/** ToDo ウィジェット。ミニアプリ「予定とToDo」のデータ(`planner\data`)から、「次にやること」(期限の近い順に 6 件)と、今日の予定(2 件まで)を出す。チェックで完了、入力欄で追加もできる(同じデータを書き換える)。 */
export function TodoWidget() {
  const store = useAppData("miniapp", PLANNER_APP);
  const tasks = parseList<PlanTask>(store.tasks);
  const events = parseList<PlanEvent>(store.events);
  const [text, setText] = useState("");
  const today = ymdOf(new Date());
  const open = tasks
    .filter((x) => !x.done)
    .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999") || a.ts - b.ts);
  const next = open.slice(0, 6);
  const todays = events.filter((e) => e.date === today).slice(0, 2);
  const save = (list: PlanTask[]) => writeList(PLANNER_APP, "tasks", list.slice(-300));
  const dueLabel = (d: string) => (d === today ? t("todoToday") : d.slice(5).replace("-", "/"));
  return (
    <div className="wcard wtodo">
      <button
        className="wcard-title wtodo-head"
        onClick={() => window.dispatchEvent(new CustomEvent("alumi:open-miniapp-id", { detail: PLANNER_APP }))}
      >
        {t("widgetTodo")}
        {open.length > 0 && <span className="wdim"> {open.length}</span>}
        <span className="wdim"> ↗</span>
      </button>
      {todays.map((e) => (
        <div key={e.id} className="wtodo-event">
          {t("todoEvent")}: {e.t}
        </div>
      ))}
      <div className="wtodo-list">
        {next.length === 0 && <span className="wdim">{t("todoEmpty")}</span>}
        {next.map((x) => (
          <label key={x.id} className="wtodo-row">
            <input
              type="checkbox"
              checked={false}
              onChange={() => save(tasks.map((y) => (y.id === x.id ? { ...y, done: true, doneAt: Date.now() } : y)))}
            />
            <span>{x.t}</span>
            {x.due && (
              <em className={`wdue${x.due < today ? " late" : x.due === today ? " today" : ""}`}>{dueLabel(x.due)}</em>
            )}
          </label>
        ))}
      </div>
      <input
        className="wtodo-add"
        value={text}
        maxLength={120}
        placeholder={t("todoPlaceholder")}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter" && text.trim() && !e.nativeEvent.isComposing) {
            save([
              ...tasks,
              { id: `w${Date.now().toString(36)}`, t: text.trim(), done: false, due: "", cat: "", ts: Date.now() },
            ]);
            setText("");
          }
        }}
      />
    </div>
  );
}
