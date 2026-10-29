import { api } from "../../shared/api/ApiModel";
import { t } from "../../shared/i18n/i18n";

/**
 * 右上の、ウィンドウのボタン(最小化・最大化/元に戻す・隠す)。ウィンドウの枠が無いので、ここをドラッグしてウィンドウを動かす。
 * @param maximized いま最大化されているか(ボタンの絵と説明が変わる)
 */
export function TitleBar({ maximized }: { maximized: boolean }) {
  return (
    <div className="titlebar" data-tauri-drag-region>
      <button aria-label={t("minimize")} title={t("minimize")} onClick={() => api.windowAction("minimize")}>
        <svg viewBox="0 0 12 12" width="12" height="12">
          <path d="M2 6h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
      <button
        aria-label={maximized ? t("restore") : t("maximize")}
        title={maximized ? t("restore") : t("maximize")}
        onClick={() => api.windowAction("maximize")}
      >
        {maximized ? (
          <svg
            viewBox="0 0 12 12"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          >
            <rect x="2" y="3.8" width="6.2" height="6.2" rx="0.8" />
            <path d="M4 3.8V2.8a.8.8 0 0 1 .8-.8h4.4a.8.8 0 0 1 .8.8v4.4a.8.8 0 0 1-.8.8H8.2" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 12 12"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          >
            <rect x="2" y="2" width="8" height="8" rx="1" />
          </svg>
        )}
      </button>
      <button aria-label={t("hide")} className="close" onClick={() => api.windowAction("hide")}>
        <svg viewBox="0 0 12 12" width="12" height="12">
          <path d="M2.5 2.5l7 7m0-7l-7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
