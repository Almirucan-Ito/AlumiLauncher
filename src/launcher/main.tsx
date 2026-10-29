import React from "react";
import ReactDOM from "react-dom/client";
// 本体の styles.css を先に読む(ウィジェットごとの style.css は、この後に読み込まれて、同じ強さの規則では、そちらが勝つ)
import "./shared/styles/styles.css";
import { App } from "./App";
import { api } from "./shared/api/ApiModel";

// 画面で起きた想定外の失敗は、記録(ログ)に残す(この PC の中だけ。どこにも送らない)
window.addEventListener("error", (e) => {
  api.writeLog("error", `${e.message} (${e.filename}:${e.lineno})`);
});
window.addEventListener("unhandledrejection", (e) => {
  const r = e.reason;
  api.writeLog("error", `unhandledrejection: ${r instanceof Error ? (r.stack ?? r.message) : String(r)}`);
});

// ブラウザ標準の右クリックメニューは出さない(アプリ独自のメニューを使う)
window.addEventListener("contextmenu", (e) => e.preventDefault());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
