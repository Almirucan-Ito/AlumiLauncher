import { defineConfig } from "vitest/config";
import { type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
};

/** ブラウザだけで動かすとき(`npm run dev`)に、`src/<name>` の中身を `/<name>/…` として配る(本番は Rust 側が埋め込んで配る)。 */
function serveFolder(name: string): Plugin {
  const root = join(__dirname, "src", name);
  return {
    name: `serve-${name}`,
    configureServer(server) {
      server.middlewares.use(`/${name}`, (req, res, next) => {
        const rel = normalize(decodeURIComponent((req.url ?? "/").split("?")[0])).replace(/^([\\/])+/, "");
        const file = join(root, rel);
        if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader("Content-Type", MIME[extname(file)] ?? "application/octet-stream");
        createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), serveFolder("miniapps"), serveFolder("widgets")],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: { target: "es2021", sourcemap: false },
  // テスト(`npm test`): 画面の部品・フックは jsdom で、純粋な関数は、そのまま動かす
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    restoreMocks: true,
  },
});
