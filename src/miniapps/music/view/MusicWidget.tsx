import "./widget.css";
import { fmtTime } from "../../../launcher/shared/lib/FormatUtil";
import { player, usePlayer } from "../controller/PlayerController";
import { t } from "../i18n";

/** 音楽プレーヤーのウィジェット。曲名・シャッフル・リピート(オフ → 全曲 → 1 曲)・音量・前へ/再生・一時停止/次へ・再生位置・時間を出す。曲名を押すと、ミニアプリ「ミュージック」を開く。プレーヤー本体(`player`)を操作するだけ。 */
export function MusicWidget() {
  const st = usePlayer();
  const btn = "wmusic-btn";
  return (
    <div className="wcard wmusic">
      {/* 上の段: 曲名(左)と、横向きの音量(右上) */}
      <div className="wmusic-top">
        <button
          className="wmusic-title"
          title={t("widgetMusic")}
          onClick={() => window.dispatchEvent(new CustomEvent("alumi:open-miniapp-id", { detail: "music" }))}
        >
          {st.title || t("musicNone")}
        </button>
        <div className="wmusic-modes">
          <button
            className={`${btn}${st.shuffle ? " on" : ""}`}
            aria-label="shuffle"
            aria-pressed={st.shuffle}
            title={st.shuffle ? t("musicShuffleOn") : t("musicShuffleOff")}
            onClick={() => player.setShuffle(!st.shuffle)}
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 3h5v5M21 3l-6.5 6.5M3 6h4l10 12h4M21 21v-5h-5M3 18h4l2-2.4" />
            </svg>
          </button>
          <button
            className={`${btn}${st.repeat !== "off" ? " on" : ""}`}
            aria-label="repeat"
            title={
              st.repeat === "one"
                ? t("musicRepeatOne")
                : st.repeat === "all"
                  ? t("musicRepeatAll")
                  : t("musicRepeatOff")
            }
            onClick={() => player.setRepeat(st.repeat === "off" ? "all" : st.repeat === "all" ? "one" : "off")}
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" />
            </svg>
            {st.repeat === "one" && <span className="wmusic-one">1</span>}
          </button>
        </div>
        <div className="wmusic-vol">
          <button className={btn} aria-label="mute" onClick={() => player.setMuted(!st.muted)}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M3 9v6h4l5 5V4L7 9z" />
              {st.muted || st.volume === 0 ? (
                <path d="M16 9l5 6m0-6l-5 6" stroke="currentColor" strokeWidth="2" fill="none" />
              ) : (
                <path d="M16 8.5a5 5 0 0 1 0 7l-1.4-1.4a3 3 0 0 0 0-4.2z" />
              )}
            </svg>
          </button>
          <input
            className="wmusic-hslider"
            style={{ ["--p" as string]: `${(st.muted ? 0 : st.volume) * 100}%` }}
            type="range"
            min={0}
            max={100}
            value={Math.round((st.muted ? 0 : st.volume) * 100)}
            aria-label="volume"
            onChange={(e) => player.setVolume(Number(e.target.value) / 100)}
          />
        </div>
      </div>
      <div className="wmusic-ctrl">
        <button className={btn} aria-label="prev" onClick={() => player.prev()}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M6 5h2v14H6zM20 5v14L9.5 12z" />
          </svg>
        </button>
        <button className={`${btn} play`} aria-label="play" onClick={() => player.toggle()}>
          {st.playing ? (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M7 4.5v15l13-7.5z" />
            </svg>
          )}
        </button>
        <button className={btn} aria-label="next" onClick={() => player.next()}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M16 5h2v14h-2zM4 5l10.5 7L4 19z" />
          </svg>
        </button>
      </div>
      <input
        className="wmusic-seek"
        style={{ ["--p" as string]: `${st.duration ? (st.position / st.duration) * 100 : 0}%` }}
        type="range"
        min={0}
        max={1000}
        value={st.duration ? Math.round((st.position / st.duration) * 1000) : 0}
        disabled={!st.duration}
        onChange={(e) => player.seek((Number(e.target.value) / 1000) * st.duration)}
      />
      {/* 現在の再生位置 / 曲の長さ */}
      <div className="wmusic-time">
        <span>{fmtTime(st.position)}</span>
        <span>{fmtTime(st.duration)}</span>
      </div>
    </div>
  );
}
