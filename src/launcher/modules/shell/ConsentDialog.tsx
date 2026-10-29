import { t } from "../../shared/i18n/i18n";

/** 外部のサーバーと通信するもの(ウィジェット・ミニアプリ)を、初めて使うときの、同意の確認。 */
export type ConsentRequest = {
  /** 画面に出す名前 */
  name: string;
  /** 同意の記録のキー(`widget:...` / `miniapp:...`) */
  key: string;
  /** Web ミニアプリか(文言が変わる) */
  web: boolean;
  /** 同意された後に行うこと(ミニアプリを開く、など) */
  after?: () => void;
};

/**
 * 外部との通信に同意するかを聞く画面。Esc や外側のクリックで、閉じる(同意しない)。
 * @param consent 聞く内容
 * @param onCancel 閉じるとき
 * @param onAllow 「同意する」を押したとき
 */
export function ConsentDialog({
  consent,
  onCancel,
  onAllow,
}: {
  consent: ConsentRequest;
  onCancel: () => void;
  onAllow: (consent: ConsentRequest) => void;
}) {
  return (
    <div className="modal" onClick={onCancel} onContextMenu={(e) => e.stopPropagation()}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t("consentTitle")}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onCancel();
          }
        }}
      >
        <h3>{t("consentTitle")}</h3>
        <div className="hint">{t(consent.web ? "consentBodyWeb" : "consentBody", { name: consent.name })}</div>
        <div className="dialog-actions">
          <button className="small ghost-btn" onClick={onCancel}>
            {t("cancel")}
          </button>
          <button className="small primary" autoFocus onClick={() => onAllow(consent)}>
            {t("consentAllow")}
          </button>
        </div>
      </div>
    </div>
  );
}
