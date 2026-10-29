/**
 * Windows のメディアキー・音量オーバーレイから、再生・一時停止・前の曲・次の曲を操作できるようにする(使えない環境では、何もしない)。
 * @param handlers 各操作を受け取る関数
 */
export function bindMediaKeys(handlers: { play: () => void; pause: () => void; prev: () => void; next: () => void }) {
  const ms = typeof navigator !== "undefined" ? navigator.mediaSession : undefined;
  if (!ms) return;
  const set = (a: MediaSessionAction, f: () => void) => {
    try {
      ms.setActionHandler(a, f);
    } catch {
      /* 使えない操作は無視 */
    }
  };
  set("play", handlers.play);
  set("pause", handlers.pause);
  set("previoustrack", handlers.prev);
  set("nexttrack", handlers.next);
}

/**
 * メディアキー・音量オーバーレイに出す曲名を更新する。
 * @param title 曲名
 */
export function showMediaTitle(title: string) {
  const ms = typeof navigator !== "undefined" ? navigator.mediaSession : undefined;
  if (ms && typeof MediaMetadata !== "undefined") ms.metadata = new MediaMetadata({ title });
}
