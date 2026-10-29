# Contributing to AlumiLauncher

> This is the English version of [CONTRIBUTING.md](CONTRIBUTING.md) (Japanese). If the two differ, the Japanese one is the original. Most other documents in `docs/` are Japanese only; [docs/architecture_EN.md](docs/architecture_EN.md) is the English overview of the structure.

> **About languages — please read.** English is welcome: Issues, Pull Requests and code comments may all be written in English. However, the author is **not comfortable reading English**, so replies to English Issues and Pull Requests may be slow, and some may be **left without an answer for a long time**. It helps a lot if you keep things short and plain: a clear title, what you changed, and why. Adding a short Japanese summary is even better, if you can. Thank you for your understanding.

AlumiLauncher is a Windows launcher with a smartphone-home-screen look (Tauri 2 + React / TypeScript + Rust).
This guide is for people touching the source for the first time. Setting up the environment: [docs/setup.md](docs/setup.md) (Japanese). Working with GitHub (Issues, Pull Requests, releases): [docs/github-workflow.md](docs/github-workflow.md) (Japanese). Managing UI text: [docs/i18n.md](docs/i18n.md) (Japanese).

## 1. Set up the environment

| Purpose                                     | What you need                                                                                  |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Editing, type checking, formatting (any OS) | Node.js 22 or later, Rust (`rustup`, the `x86_64-pc-windows-msvc` target, `clippy`, `rustfmt`) |
| Running, testing, building the installer    | **Windows 10/11** (the app uses Win32 and WebView2), Visual Studio Build Tools (C++), WebView2 |

You can also edit in WSL2 (Ubuntu) and run on Windows. In WSL you can check the code as a Windows build like this:

```bash
npm ci
cd src-tauri && cargo clippy --target x86_64-pc-windows-msvc -- -D warnings
```

If you use VS Code, it suggests the recommended extensions when you open the folder (`.vscode\extensions.json`). `miniapp.json` / `widget.json` get completion from the schemas in `schemas\`.

## 2. Common commands

| What you want to do                                                    | Command                                                 |
| ---------------------------------------------------------------------- | ------------------------------------------------------- |
| Look at the UI only, in a browser (no Rust; saving etc. are simulated) | `npm run dev` → http://localhost:1420                   |
| Run the app (Windows)                                                  | `npm run tauri dev`                                     |
| **Check everything before submitting**                                 | `npm run check`                                         |
| Format                                                                 | `npm run format` / `cargo fmt` (in `src-tauri`)         |
| UI tests (Vitest)                                                      | `npm test`                                              |
| Rust tests                                                             | `cargo test` (in `src-tauri`)                           |
| Build the installer                                                    | `.\scripts\release.ps1` (add `-Zip` to also make a zip) |

`npm run check` runs `tsc` (types), ESLint, Prettier, the mini-app / widget checks (`check:miniapps`: JSON, files exist, JavaScript syntax), a check for misspelled names in that JavaScript (`check:js`) and the UI tests (Vitest). If you add or update a dependency (`package.json`, `Cargo.toml`), run `npm run licenses` to regenerate `THIRD_PARTY_LICENSES.md` (run it where the Rust sources are already fetched). The UI tests include an accessibility test with axe-core (`src/launcher/App.a11y.test.tsx`: home, settings, folder, the "+" menu). When you add a new screen, add it to that test too. For Rust, also pass `cargo fmt --check` and `cargo clippy -- -D warnings`.

## 3. Where to change what (three areas)

The project has three areas. **You only need to touch the area you want to change.**

```
src/
 ├ app/         ① The launcher itself (by feature)   ← only here to fix or grow the launcher
 │   ├ App.tsx / main.tsx  entry point and overall assembly
 │   ├ modules/    by module (one per feature: shell, home, folders, history, settings, widgets, miniapps, start-apps, icons, plugins)
 │   └ shared/      parts used across modules (api, ui, drag, audio, i18n, styles, lib)
 ├ miniapps/    ② Mini-apps (one folder = one app)   ← only here to make or fix a mini-app
 │   └ <id>/        miniapp.json / icon.svg / view/ / controller/ … (see below)
 └ widgets/     ③ Widgets (one folder = one widget)  ← only here to make or fix a widget
     └ <id>/        widget.json / icon.svg / index.tsx / view/ / model/ / i18n.ts … (see below)
```

### ② Making or fixing a mini-app (only `src/miniapps/<id>/`)

```
src/miniapps/<id>/
 ├ miniapp.json       name, description, permissions, entry (entry is view/index.html)
 ├ icon.svg
 ├ view/              the screen: index.html and style.css
 ├ controller/        the behavior: main.js (the screen's JavaScript; when it grows, split it by role into several files and list the `<script>` tags in load order in index.html)
 ├ model/             (optional) the part that handles data
 ├ widgets/<name>/    (optional) widgets of this mini-app (widget.json)
 └ index.tsx          (optional) the part on the launcher's side (see below)
```

- Copy `miniapps/_examples/template-app/`, rename it to `<id>`, and you have a new mini-app. **Nothing needs to be added to Rust or to the launcher** (whether it is bundled is automatic, just by having the folder).
- A normal mini-app has only `view/` and `controller/` (it runs inside a sandboxed iframe). It can use launcher features only through `postMessage`, and only those listed in `permissions` of `miniapp.json`.
- Add `index.tsx` **only when a part is needed on the launcher's side** (example: the music player keeps playing after its mini-app is closed, so the player itself lives in the launcher). `controller/`, `view/` and `i18n.ts` also live inside the mini-app's folder. The launcher **finds automatically** the default export of `index.tsx` (`definePlugin({ ... })`):
  - `widgets` … widget components (registered under the same name as `builtin` in `widget.json`)
  - `bridges` … launcher-side features a mini-app can call with `postMessage` (example: `player.*`)
  - `hooks` … functions called at start-up, when the volume changes, and after data is cleared
- Example: `miniapps/music/` (`controller/PlayerController.ts`, `Playlists.ts` and `PlayerBridge.ts`, `view/MusicWidget.tsx`, `index.tsx`)

### ③ Making or fixing a widget (only `src/widgets/<id>/`)

- To make a React component that runs inside the launcher's screen, write `"builtin": "<id>"` in `widget.json` and pass `definePlugin({ widgets: { <id>: { component, cells } } })` from `index.tsx` (example: `widgets/todo/`).
- To make one with just a little HTML, copy `widgets/_examples/template-widget/` (`widget.json` and `view/index.html`).
- Keep the text in the folder's own `i18n.ts` (`defineMessages(japanese, english)`). Name, description and icon of a widget go in `widget.json` and `icon.svg` (do not add them to the launcher's text table).
- Parts shared by several widgets go in `widgets/common/`.

### ① Fixing the launcher itself (only `src/launcher/`)

| What you want to do                 | Where to change                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Change text / add a language        | `src/launcher/shared/i18n/messages.ja.ts` and `messages.en.ts`                                                                                                                                                                                                                                                                                                                                                                                                    |
| Change the look                     | `src/launcher/shared/styles/` (the entry is `styles.css`, which loads the per-feature files in order. **The load order is the priority order of the rules, so do not reorder.** CSS specific to a widget lives in that widget's `view/style.css`)                                                                                                                                                                                                                 |
| Home, folders, settings             | `src/launcher/modules/home/`, `folders/`, `settings/`, `shell/` (write the logic as a hook `use…`; `src/launcher/App.tsx` only connects them)                                                                                                                                                                                                                                                                                                                     |
| The widget bars and the add screen  | `src/launcher/modules/widgets/` (`WidgetBar.tsx`, `WidgetPicker.tsx`)                                                                                                                                                                                                                                                                                                                                                                                             |
| The mini-app host                   | `src/launcher/modules/miniapps/miniapp.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Call a Rust feature from the screen | Add a `#[tauri::command]` in the matching feature folder of `src-tauri/src/` (`config/`, `files/`, `extensions/`, `window/`, `platform/`) and list it in `generate_handler!` in `lib.rs`. In `src/launcher/shared/api/`, add the type (`ApiTypes.ts`), the call (in the matching area file: one of `ApiApp`, `ApiWindow`, `ApiFiles`, `ApiExtensions`, `ApiMedia`; `ApiModel.ts` merges them so you can call `api.xxx()`) and the browser stand-in (`ApiMock.ts`) |
| A new permission for mini-apps      | Add it to `schemas/miniapp.schema.json` (the permission names; Rust reads this at build time) and implement it in `src/launcher/modules/miniapps/miniapp.tsx` (the host). A test tells you if you forget one                                                                                                                                                                                                                                                      |

**Boundary rule**: `src/launcher` never imports an individual mini-app or widget by name (ESLint checks this). Components of mini-apps and widgets are collected automatically by `PluginRegistry` (`src/launcher/modules/plugins/`) from each folder's `index.tsx`. Mini-apps and widgets may use the launcher's parts (`ApiModel`, `AppDataModel`, `lib/` in `shared/`).

The list and "version" of the bundled mini-apps and widgets are generated at build time by `src-tauri/build.rs` from the folders' contents (when the content changes, the version changes automatically and is rewritten at the next start-up. **You never raise the version by hand**).

## 4. Coding rules

- Formatting and checks are defined by the config files (`.editorconfig`, `.prettierrc.json`, `eslint.config.js`, `src-tauri/rustfmt.toml`). When in doubt, leave it to `npm run format` and `cargo fmt`.
- Functions, constants and types get a doc comment (JSDoc in TypeScript, `///` in Rust). **The existing comments are written in Japanese**, but comments in English are also fine. (The author reads English slowly, so please keep comments short and clear. See "About languages" at the top.)
- Encoding is UTF-8, line endings are LF (only `.ps1` files have a BOM).
- UI text: the launcher uses `t()` from `i18n.ts` (the dictionaries are `messages.ja.ts` and `messages.en.ts`); mini-apps and widgets use their own folder's messages (no hard-coded text).
- Keep mini-apps and widgets independent of the launcher. Do not touch its internals; use only the `postMessage` host, `permissions` and `definePlugin`.

## 5. Checklist before you submit

1. `npm run check` passes
2. `cargo fmt --check` / `cargo clippy -- -D warnings` / `cargo test` pass (when you touched Rust)
   - If you added logic on the UI side, add a `*.test.ts(x)` too (`npm test`)
3. Look at the screens you touched with `npm run dev` (check Windows-specific features with `npm run tauri dev`)
4. If you changed text, fix both Japanese and English
5. If user-visible behavior changed, update both `README_JP.md` and `README_EN.md`

> The browser check with `npm run dev` does not run Windows-specific features (drag-out, thumbnails, WebView2 and so on). Those can only be checked on a real Windows PC. Please say in your Pull Request which parts you did not check.
