import "./style.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { pad2 } from "../../../launcher/shared/lib/FormatUtil";
import { beep } from "../../../launcher/shared/audio/BeepController";
import { appData, useAppData } from "../../../launcher/shared/api/AppDataModel";
import { api } from "../../../launcher/shared/api/ApiModel";
import type { WidgetEnv } from "../../../launcher/modules/plugins/PluginModel";
import { t } from "../i18n";
import { TIMER_MODES, parseTimer, type TimerState } from "../model/TimerModel";

/**
 * タイマー/ポモドーロのウィジェット。終わったら、音を鳴らして、ウィンドウを前に出して知らせる。状態は `widgets\timer\data` に保存する。
 * 前回の終了時刻をとっくに過ぎているとき(アプリを閉じている間に終わったとき)は、通知せずに待機へ戻す(起動直後に、ウィンドウが前に出たり、音が鳴ったりしないように)。
 * @param env ウィジェットの窓口(終了の知らせに使う)
 */
export function TimerWidget({ env }: { env: WidgetEnv }) {
  // 状態は、widgets\timer\data に保存する(読み込みが終わったら、一度だけ、それを使う)
  const store = useAppData("widget", "timer");
  const initial = parseTimer(store.state);
  const inited = useRef(store.state !== undefined);
  // 前回の終了時刻をとっくに過ぎているとき(アプリを閉じている間に終わったとき)は、通知せずに待機へ戻す。
  // 起動直後にウィンドウが前に出たり、音が鳴ったりしないように
  const [st, setSt] = useState<TimerState>(() =>
    initial.endAt !== null && Date.now() > initial.endAt + 2000
      ? { total: initial.total, endAt: null, left: initial.total }
      : initial,
  );
  const [now, setNow] = useState(Date.now());
  const stRef = useRef(st);
  stRef.current = st;
  const { flash } = env;
  const commit = useCallback((s: TimerState) => {
    setSt(s);
    appData.set("widget", "timer", "state", JSON.stringify(s));
  }, []);
  useEffect(() => {
    if (inited.current || store.state === undefined) return;
    inited.current = true;
    setSt(parseTimer(store.state));
  }, [store.state]);
  const running = st.endAt !== null;

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const s = stRef.current;
      setNow(Date.now());
      if (s.endAt !== null && Date.now() >= s.endAt) {
        commit({ total: s.total, endAt: null, left: s.total });
        beep();
        flash(t("timerDone", { m: Math.round(s.total / 60) }));
        api.bringToFront();
      }
    };
    tick();
    const id = setInterval(tick, 500);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [running, commit, flash]);

  const left = st.endAt !== null ? Math.max(0, Math.ceil((st.endAt - now) / 1000)) : st.left;
  const mmss = `${pad2(Math.floor(left / 60))}:${pad2(left % 60)}`;
  return (
    <div className="wcard wtimer">
      <div className="wtimer-modes">
        {TIMER_MODES.map((m) => (
          <button
            key={m.min}
            className={`wmode${st.total === m.min * 60 ? " on" : ""}`}
            onClick={() => commit({ total: m.min * 60, endAt: null, left: m.min * 60 })}
          >
            {t(m.label)} {m.min}
          </button>
        ))}
      </div>
      <div className="wtimer-row">
        <span className="wtimer-time">{mmss}</span>
        <button
          className="small wtoggle on"
          onClick={() =>
            running
              ? commit({ ...st, endAt: null, left })
              : commit({ ...st, endAt: Date.now() + (left > 0 ? left : st.total) * 1000 })
          }
        >
          {t(running ? "timerPause" : "timerStart")}
        </button>
        <button className="small wtoggle" onClick={() => commit({ total: st.total, endAt: null, left: st.total })}>
          {t("timerReset")}
        </button>
      </div>
    </div>
  );
}
