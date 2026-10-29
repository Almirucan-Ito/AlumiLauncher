# Architecture

> English overview of [architecture.md](architecture.md) (Japanese, the original). Details such as the `postMessage` table and the test commands are in the Japanese one.

## Overview

```
┌─────────────── WebView2 (the screen) ───────────────┐      ┌──── Rust (src-tauri) ────┐
│ modules/*  ──→  shared/api (ApiModel.ts …) ─invoke─→ │ commands (config/files/…)  │
│  React screens and hooks     types, storage, calls   │ extensions/widgets/ …      │
│  └ <iframe sandbox>  mini-apps / widgets (HTML)      │ serves widget:// miniapp:// │
└──────────────────────────────────────────────────────┘      └────────────────────────────┘
```

- **The screen** is React / TypeScript. So that it also works in a plain browser (`npm run dev`), `ApiModel.ts` switches to simulated behavior when Tauri is absent (the lists of mini-apps and widgets are read straight from the folders' JSON).
- **The core** is Rust (`src-tauri/src`). It handles Win32 features (icon extraction, drag-out, thumbnails, shortcuts) and saving files.

## Three areas

| Area      | Where           | What it holds                                                             |
| --------- | --------------- | ------------------------------------------------------------------------- |
| Launcher  | `src/launcher/` | The core. Per-feature folders (`modules/`) + shared parts (`shared/`)     |
| Mini-apps | `src/miniapps/` | One folder = one app. `view/` (HTML, CSS) and `controller/` (JavaScript)  |
| Widgets   | `src/widgets/`  | One folder = one widget. React parts have `view/`, `model/` and `i18n.ts` |

Dependencies go **one way**: mini-apps and widgets → parts of `src/launcher` (`ApiModel`, `AppDataModel`, `lib/` in `shared/`). `src/launcher` never loads a mini-app or widget by name (checked by ESLint).

### How they are connected (plugins)

If a mini-app or widget folder has an `index.tsx`, `src/launcher/modules/plugins/PluginRegistry.ts` collects it automatically with `import.meta.glob` (the launcher side is not edited). The default export is `definePlugin({ ... })`, which accepts these three things (types in `PluginModel.ts`):

| Key       | Content                                                                                       | How the launcher uses it                                                                      |
| --------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `widgets` | Built-in widget components (same name as `builtin` in `widget.json` → `{ component, cells }`) | `WidgetBar` looks the component up by ID and shows it                                         |
| `bridges` | Features a mini-app can call with `postMessage` (`permission`, `prefix`, `handle`, `connect`) | `miniapp.tsx` hands over commands matching `prefix` (not to mini-apps without the permission) |
| `hooks`   | `onMasterVolume` (volume), `onStart` (start-up), `onDataCleared` (after data is cleared)      | `App.tsx` (and `useStartupRestore`) calls them at those moments                               |

## The launcher (`src/launcher`)

Folders are split by feature: everything about one feature (screens, state, logic, types) sits in one folder.

| Where                                                | What                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `App.tsx` / `main.tsx`                               | Entry point and assembly. `App.tsx` (about 400 lines) holds only the "what is open" state and connects the hooks and parts below                                                                                                                                                                                              |
| `modules/shell/`                                     | The app's frame. Parts: `TitleBar`, `PresetSwitcher`, `CornerButtons`, `ConsentDialog`, `DeleteDialog`, `ContextMenu`. Hooks: `useConfigStore`, `useWindowMode`, `useToast`, `useGlobalKeys`, `useStartupRestore`, `useBackendEvents`                                                                                         |
| `modules/home/`                                      | The home screen (`HomeScreen`, context menus `useHomeMenus`), order of the home (`HomeModel`, `useHomeEntries`), search (`useHomeSearch`), drag hand-over between home and a folder (`useDragHandover`), drops from Explorer (`useExplorerDrop`)                                                                              |
| `modules/folders/`                                   | Folders (`FolderTile`, `FolderView`, `RenameDialog`, `useFolderItems`, `FolderModel`) and folder / icon operations (`useFolderActions`)                                                                                                                                                                                       |
| `modules/history/`                                   | Undo (Ctrl+Z) / redo (Ctrl+Y) (`useUndoHistory`)                                                                                                                                                                                                                                                                              |
| `modules/settings/`                                  | The settings screen (`SettingsPanel` and its groups `SizeGroup`, `AppearanceGroups`, `LayoutGroup` …), changing settings (`useSettingsActions`), filling in missing items (`normalizeSettings`), theme CSS variables (`ThemeModel`), tooltip toggle (`useTooltipToggle`)                                                      |
| `modules/widgets/`                                   | The widget bars (`AppWidgetBar`, `WidgetBar`), the widget list (`useWidgetList`), the add screen (`WidgetPicker`), placement math (`LayoutModel`), add / move / resize / menu (`useWidgetBars`)                                                                                                                               |
| `modules/miniapps/`                                  | The mini-app host (`miniapp.tsx`), the list screen (`MiniAppPicker`), opening / consent / lending launcher features (`useMiniApps`), alarms, migration of old data, size and clearing of data / cache (`useStorageManagement`)                                                                                                |
| `modules/start-apps/`                                | The "add from Start menu" screen                                                                                                                                                                                                                                                                                              |
| `modules/icons/`                                     | Fetching and caching icons (`IconController`)                                                                                                                                                                                                                                                                                 |
| `modules/plugins/`                                   | The mechanism that collects mini-apps and widgets automatically (`PluginModel`, `PluginRegistry`)                                                                                                                                                                                                                             |
| `shared/api/`                                        | Talking to Rust. The `api` entry (`ApiModel.ts`) merges the per-area files (`ApiApp`, `ApiWindow`, `ApiFiles`, `ApiExtensions`, `ApiMedia`). Also types and default settings (`ApiTypes.ts`), helpers (`ApiHelpers.ts`), browser stand-ins (`ApiMock.ts`), stored data (`AppDataModel.ts`), motion numbers (`TuningModel.ts`) |
| `shared/ui/`                                         | Screen parts used across modules (`Pager` (drag handling in `usePagerDrag`, props in `PagerProps`), `AppTile`, …)                                                                                                                                                                                                             |
| `shared/drag/`, `audio/`, `i18n/`, `styles/`, `lib/` | Drag helpers, beeps, UI text (`i18n.ts` with `t()`, dictionaries `messages.ja.ts` / `messages.en.ts`), styles (`styles.css` loads per-feature files in order; the order is the priority order), small utilities                                                                                                               |

Rules: a module (`modules/*`, one per feature of the launcher) may use `shared/`, and dependencies between modules are kept to a minimum. `shared/` never uses a module.

`App.tsx` holds the "what is open" state (the open folder, menu, settings, dialogs …) and only connects feature hooks and parts. The logic lives in hooks (`useUndoHistory`, `useFolderActions`, `useMiniApps`, `useSettingsActions`, `useWidgetBars`, `useStorageManagement`, `useDragHandover` / `useExplorerDrop`, `useGlobalKeys` …). Hooks pass `configRef` (always the latest settings), `mutate` (change and save settings), `flash` (notifications), `launcherRef` and `entriesRef` to each other as arguments. **When you add a feature, do not write the logic in `App.tsx`; add it under `modules/` as a hook.**

## Mini-apps and widgets

- One folder = one item. `miniapp.json` (or `widget.json`) plus `view/`, `controller/` and so on are self-contained.
- At run time they live in `%AppData%\AlumiLauncher\miniapps\<id>\` and `widgets\<id>\` (portable: inside `<exe>\data`).
- Bundled ones are embedded into the executable by `src-tauri/build.rs` (folders starting with `_` — the examples — and `common` are excluded) and written out at start-up. **The version is a hash of the embedded content**, so changing the content rewrites them at the next start. Items the user deleted are not recreated (recorded in `.alumi-seeded`).
- They are served by the `miniapp://` / `widget://` protocols and run inside `<iframe sandbox>`. They cannot touch the launcher directly; they ask through `postMessage`.
- A mini-app can use only the permissions listed in its `miniapp.json`. The permission names come from `schemas/miniapp.schema.json`.
- Only mini-apps with `"network": true` can talk to external servers, and only after the user agrees the first time; after that, the CSP `connect-src` opens.

## Where data lives

| What                        | Where                                                             |
| --------------------------- | ----------------------------------------------------------------- |
| Settings, order of the home | `%AppData%\AlumiLauncher\` (portable: `<exe>\data\`)              |
| Data of mini-apps / widgets | `data\` in each folder (things that may disappear go to `cache\`) |
| Log                         | `%AppData%\AlumiLauncher\logs\alumi.log` (up to about 0.5 MB)     |

## Start-up flow

Rust starts → writes out the bundled mini-apps and widgets (only when the version hash differs) → the screen loads settings and icons (waits with `whenIconsSettled`) → each plugin's `onStart` (restoring the music player and so on) → `app_ready` shows the window.

## Tests and checks

- Rust: `cargo test`.
- Screen: Vitest (`npm test`). Drag operations and other visual behavior are checked with types (`tsc`), ESLint and by eye with `npm run dev`.
- Mini-apps and widgets: `npm run check:miniapps` and `npm run check:js`.
