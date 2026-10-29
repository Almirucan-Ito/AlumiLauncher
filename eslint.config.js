import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

// コーディング規約(TypeScript): 推奨ルール + React Hooks のルール。整形は Prettier(.prettierrc)に任せる。
export default tseslint.config(
  // ミニアプリ・ウィジェットの中の JavaScript(sandbox の iframe で動く、ブラウザ用のもの)は、対象外。TypeScript(ランチャー側の部分)は対象
  { ignores: ["dist", "node_modules", "src-tauri", "release", "src/miniapps/**/*.js", "src/widgets/**/*.js"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      // React Compiler 向けの新ルール(refs / purity など)は、「最新の値を ref に持つ」書き方を多用しているため使わない
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      eqeqeq: ["error", "always", { null: "ignore" }],
      "prefer-const": "error",
      "no-var": "error",
    },
  },
  // 境界の決まり: ランチャー本体(src/launcher)は、個々のミニアプリ・ウィジェット(src/miniapps・src/widgets)を名前で読み込まない(PluginRegistry が自動で集める)。
  // 深さごとに、src へ出る道(`../` の数)で見分ける(src/launcher/modules/widgets などの、本体の中のフォルダは対象外)
  ...[
    ["src/launcher/*.{ts,tsx}", "^\\.\\./(miniapps|widgets)/"],
    ["src/launcher/*/*/*.{ts,tsx}", "^\\.\\./\\.\\./\\.\\./(miniapps|widgets)/"],
  ].map(([glob, regex]) => ({
    files: [glob],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex,
              message:
                "ランチャー本体から、ミニアプリ・ウィジェットを直接読み込まないでください(PluginRegistry を使います)。",
            },
          ],
        },
      ],
    },
  })),
  { files: ["vite.config.ts", "eslint.config.js", "scripts/*.mjs"], languageOptions: { globals: globals.node } },
  // テストは、Node の機能(ファイルの読み込みなど)も使う
  { files: ["src/**/*.test.{ts,tsx}"], languageOptions: { globals: { ...globals.browser, ...globals.node } } },
);
