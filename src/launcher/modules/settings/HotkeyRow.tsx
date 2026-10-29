import { keyName, validHotkey } from "./SettingsModel";
import { api } from "../../shared/api/ApiModel";
import { t } from "../../shared/i18n/i18n";
import { useEffect, useRef, useState } from "react";

/**
 * ショートカットの設定の行。「変更」を押してから、割り当てたいキーを順に押して離す(押したキーをすべて離した時点で確定。Esc で取り消し)。
 * 登録中は、いま使っているショートカットを一時的に外す(外さないと、同じ組み合わせが、画面ではなくショートカットのほうに先に届いてしまう)。
 * @param value 現在の組み合わせ
 * @param enabled ショートカットを有効にしているか
 * @param onChange 新しい組み合わせが決まったとき
 */
export function HotkeyRow({
  value,
  enabled,
  onChange,
}: {
  value: string;
  enabled: boolean;
  onChange: (combo: string) => void;
}) {
  const [rec, setRec] = useState(false);
  const [bad, setBad] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!rec) return;
    // 登録中のショートカット(今の組み合わせ)を一時的に外す。外さないと、Alt+Space のようにいま使っている組み合わせを
    // 押したとき、画面ではなくショートカットのほうが先に受け取ってしまい、正しく入力できない
    let accepted = false;
    if (enabledRef.current) api.setHotkeysEnabled(false);
    const seq: string[] = [];
    const down = new Set<string>();
    let unsupported = false;
    const finish = () => {
      setRec(false);
      if (!unsupported && validHotkey(seq)) {
        setBad(false);
        accepted = true; // 新しい組み合わせの登録は onChange(set_hotkey)がやる
        onChangeRef.current(seq.join("+"));
      } else setBad(true);
    };
    const onDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.code === "Escape") return setRec(false);
      if (e.repeat) return;
      down.add(e.code);
      const n = keyName(e.code);
      if (n === null) unsupported = true;
      else if (!seq.includes(n)) seq.push(n);
    };
    // 押したキーをすべて離したときに確定する(「Alt を押したまま Space、続けて L」のような順番押しも、Alt を離した時点で確定)
    const onUp = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      down.delete(e.code);
      if (down.size === 0) finish();
    };
    const cancel = () => setRec(false);
    window.addEventListener("keydown", onDown, true);
    window.addEventListener("keyup", onUp, true);
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("keydown", onDown, true);
      window.removeEventListener("keyup", onUp, true);
      window.removeEventListener("blur", cancel);
      if (!accepted && enabledRef.current) api.setHotkeysEnabled(true); // 変えなかったときは、元のショートカットを戻す
    };
  }, [rec]);

  return (
    <>
      <div className="row">
        <span className="row-label">{t("hotkeyKeys")}</span>
        <button
          className={`small hk${rec ? " rec" : ""}`}
          onClick={() => {
            setBad(false);
            setRec((r) => !r);
          }}
        >
          {rec ? t("hotkeyPress") : value}
        </button>
      </div>
      {bad && <div className="hint">{t("hotkeyInvalid")}</div>}
    </>
  );
}
