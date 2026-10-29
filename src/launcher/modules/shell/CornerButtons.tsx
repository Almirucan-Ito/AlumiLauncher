import { t } from "../../shared/i18n/i18n";

/**
 * 右下の、丸いボタン(＋・再読み込み・設定)。
 * @param folderOpen フォルダを開いているか(＋の説明が、「ファイルを追加」に変わる)
 * @param settingsOpen 設定を開いているか(設定のボタンを、押した状態にする)
 * @param onPlus ＋を押したとき
 * @param onReload 再読み込みを押したとき
 * @param onToggleSettings 設定を押したとき(開く/閉じる)
 */
export function CornerButtons({
  folderOpen,
  settingsOpen,
  onPlus,
  onReload,
  onToggleSettings,
}: {
  folderOpen: boolean;
  settingsOpen: boolean;
  onPlus: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onReload: () => void;
  onToggleSettings: () => void;
}) {
  return (
    <div className="corner" onClick={(e) => e.stopPropagation()}>
      <button
        className="round"
        aria-label={folderOpen ? t("addFiles") : t("plusTitle")}
        title={folderOpen ? t("addFiles") : t("plusTitle")}
        onClick={onPlus}
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <button className="round" aria-label={t("reload")} title={t("reload")} onClick={onReload}>
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 11a8 8 0 1 0-2.3 5.7" />
          <path d="M20 4v7h-7" />
        </svg>
      </button>
      <button
        className={`round${settingsOpen ? " active" : ""}`}
        aria-label={t("settings")}
        title={t("settings")}
        onClick={onToggleSettings}
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
      </button>
    </div>
  );
}
