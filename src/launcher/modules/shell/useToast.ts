import { useCallback, useState } from "react";

/**
 * 画面の下に出す、短いメッセージ(トースト)。
 *
 * @returns
 * - `toast`: いま出している文言(無ければ `null`)
 * - `flash`: メッセージを 2.4 秒だけ出す関数(同じ文言で続けて呼んでも、後の分の 2.4 秒で消える)
 */
export function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 2400);
  }, []);
  return { toast, flash };
}
