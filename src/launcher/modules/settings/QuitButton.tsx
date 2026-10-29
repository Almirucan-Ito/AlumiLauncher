import { api } from "../../shared/api/ApiModel";
import { t } from "../../shared/i18n/i18n";
import { useEffect, useState } from "react";

/** 設定の一番下の「アプリを終了する」ボタン。トレイに常駐しているものも含めて、完全に終了する。押し間違いを防ぐため、2 回押す(1 回目から 3 秒以内)と実行する。 */
export function QuitButton() {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = window.setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(id);
  }, [armed]);
  return (
    <button className={`reset quit${armed ? " armed" : ""}`} onClick={() => (armed ? api.quitApp() : setArmed(true))}>
      {armed ? t("quitConfirm") : t("quitApp")}
    </button>
  );
}
