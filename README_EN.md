# AlumiLauncher

[日本語](README_JP.md) | English

> The Japanese README ([README_JP.md](README_JP.md)) is the primary one and is the most detailed. This English version covers everything a user needs; developer documents under `docs/` are in Japanese only for now.

## What is AlumiLauncher?

A launcher for Windows that arranges your apps, files and folders **in a grid, like a smartphone home screen**, and starts them with a click.
You can register ordinary Windows folders (folders full of shortcuts) as they are, reorder icons by dragging, and make folders by dropping one icon on another.
The top and bottom of the window can hold widgets (clock, search, to-do, timer…), and **mini apps** (notes, music player, planner, clocks and timers, search, image viewer…) run inside the launcher.
Mini apps and widgets can be written with plain HTML / JavaScript ([how to](docs/extending.md), in Japanese).

**Good for**: people who want to tidy up a desktop full of shortcuts / gather the apps and folders they use most on one screen / keep small tools (notes, timer, music player) in one app.

### Features

- Runs fully locally. The app itself does not use the network. Widgets and mini apps that need it must declare it and get your consent the first time ([details](#network-access)).
- Tauri 2 (Rust) + React / TypeScript. Small and light.
- Show / hide with a shortcut (default `Ctrl+Alt+L`, changeable to any 2–3 keys), lives in the system tray, optional start with Windows (**off by default**).
- Drag and drop folders and shortcuts to add them, drag to reorder, rename folders (the real folder name is not changed).
- Background (color, light/dark, image, transparency), icon size / spacing / count. The display language (Japanese / English) follows Windows.

## System requirements

| Item | Required | Notes |
|---|---|---|
| OS | **Windows 10 / 11 (64-bit)** | Developed and tested on Windows 11. Windows 10 should work but has not been verified on a real machine |
| WebView2 runtime | Required | Included in Windows 11 and recent Windows 10. The standard installer downloads it if missing |
| CPU | 64-bit (x64) | Windows on ARM has not been verified |
| Memory | 4 GB or more (8 GB recommended) | The app plus WebView2 used about 270 MB (measured once, right after start on Windows 11) |
| Storage | 100 MB free or more | Install size is tens of MB; the offline installer is about 210 MB. Logs and mini-app data grow with use |
| Display | 1280×720 or larger recommended | The window can be as small as 240×60. Desktop mode does not support multiple monitors |

No internet connection is needed to use it (only the standard installer downloads WebView2 on a PC that lacks it).

## Install

Download one of these from [Releases](../../releases):

| File | Description |
|---|---|
| `AlumiLauncher_Setup.exe` | Standard installer (about 3.5 MB). Windows 11 already has WebView2, so it normally does not touch the network |
| `AlumiLauncher_Portable.zip` | Portable version. No installation: unzip and run `AlumiLauncher.exe`. Data is kept in the `data` folder next to it (to remove it, delete the folder) |
| `AlumiLauncher_Setup_Offline.exe` | Offline installer (about 210 MB). Bundles WebView2; never uses the network, even during installation |

No administrator rights are needed (it installs per user and can be removed from Settings → Apps).

### About the SmartScreen warning

The installer is **not code-signed yet**, so Windows may show "Windows protected your PC" the first time.
Choose **"More info" → "Run anyway"**. To verify the file, compare its hash with `SHA256SUMS.txt`:

```powershell
Get-FileHash .\AlumiLauncher_Setup.exe -Algorithm SHA256
```

If it matches the value in `SHA256SUMS.txt`, the file is exactly what was published. The source is in this repository, so you can also build it yourself.

## How to use

- **Shortcut key**: change it in Settings → "Launch". Press "Change", then press the keys you want. Start with Ctrl / Alt / Shift and use **2–3 keys** (e.g. `Ctrl+Space`, `Ctrl+Alt+L`). A combination another app already uses cannot be registered, so the old one stays.
- **＋ (bottom right)**: on the home screen, a menu (Add folder / Add from Start menu / Add widget / Add mini app). Inside a folder, it adds files to that folder.
- **Right-click on the home screen**: "Create folder" / "New file" (an empty `.txt`) / "Add widget".
- **Drop a folder** on the window: it is added to the list as it is.
- **Drop shortcuts / exe files / files** on the home screen: they are **moved** into the data folder (`%AppData%\AlumiLauncher\launcherFolder`) and appear as app icons.
- **＋ → "Add from Start menu"**: pick any app from the Windows Start menu (desktop or Store apps); its shortcut is **copied** to the home screen (the original is untouched). Dragging from the Start menu is not supported by Windows for this kind of window, so use this screen.
- **Right-click an icon**: Open with… (choose an app) / Open file location / Properties / Move to Recycle Bin (only for files in a registered folder).
- **Right-click a folder**: Rename (display name only; the real folder name is not changed) / Open in Explorer / Properties / Remove from the list.
- **Long-press and drag an icon**: reorder.
  - Hold it over the **center of another icon** and release: a new folder is made containing both.
  - Drop it on a **folder's center**: it goes to the end of the folder. Hold a moment: the folder opens, and you can drop it at the exact position (like a smartphone home screen).
  - Inside a folder, drag it **outside the frame** and release: it goes to the end of the home screen. Hold a moment: the folder fades so you can drop it at any position on the home screen.
- **Ctrl+Z / Ctrl+Y**: undo / redo reordering, folder creation / rename / removal and icon moves (up to 5 each; file moves are undone too).
- Hold **Shift** while dragging to stop automatic swapping and page turning.
- Drag an icon **out of the window** to switch to a normal Windows drag and **move** the file to the desktop or an Explorer folder (not for the registered folder itself).
- **Real-time updates**: changes made in Explorer to a registered folder show up immediately.
- **Presets**: the number buttons at top left (1–3 by default, up to 9 in Settings), number keys **1–9**, or **Alt+←/→** switch between separate sets of folders and icons.
- **Keyboard**: arrow keys to move the selection, **Enter / Space** to open, **R / F5** to reload, **Esc** to close a folder or hide the window.
- **Settings (gear, bottom right)**: window size, always on top, icons per page, icon size/spacing, background, drag timing, shortcut, startup, language-independent options. "Reset to defaults" restores initial values.
- Settings are saved in `%AppData%\AlumiLauncher\config.json` (portable version: the `data` folder next to the exe).

### Log

Errors are written to `%AppData%\AlumiLauncher\logs\alumi.log` (portable: `data\logs`). When it exceeds 256 KB it is rotated to `alumi.log.old` (one old generation is kept, so the whole `logs` folder stays under about 0.5 MB). **It stays on your PC and is never sent anywhere.** If settings cannot be saved, the app tells you on screen. When reporting a bug you may attach it; check it first, because it can contain file paths.

## Screen layout

The screen is made of five bands, from top to bottom:

| Band | Contents |
| --- | --- |
| **Top** | The topmost bar: preset switcher (1 2 3) on the left, window buttons (minimize / maximize / close) on the right |
| **Header** | A band for widgets. Right-click it to set its height (small / standard / large). It is not shown when it has no widgets |
| **Home** | The largest band: icons and folders, with page turning |
| **Footer** | A band for widgets, like the header |
| **Bottom** | The bottom bar: the ＋ / reload / settings buttons on the right |

The header and footer are hidden when the window is smaller than 380 px high or 300 px wide. Below 200 px high, the top and bottom bars disappear too and only icons are shown. The smallest window is 240 × 60 px.

## Widgets

You can put widgets in the header (top) and footer (bottom) of the window. Use **＋** (or right-click the home screen) → "Add widget". Header and footer are divided into **7 columns** (1 to 7 from the left). The cells are **squares**, like the icons (one cell is a fixed **44 px**; it does not change with the icon size in Settings, and shrinks only when 7 cells do not fit in a narrow window). Widgets snap to columns and never overlap. Long-press a widget and move it to drag it to another column (or to the other bar); right-click it to change its width, move it to the other bar, or remove it. The **height is set by right-clicking the header (or footer) itself**, not the widget: small (1 cell), standard (2 cells) or large (3 cells). Every widget in that bar gets that height, and the guide squares shown while you move a widget stack up to match (they are always squares). A widget switches what it shows to fit the height (for example, the Music widget at 1 cell shows only the title and the playback buttons in one row). The header / footer are hidden when the window is smaller than 380 px high or 300 px wide.

Built in:

- **Shortcuts** — a place to keep icons and folders: **drag them from the home screen** into it (the originals stay on Home). Click an icon to launch it, or a folder to open it inside the launcher. At most **6 fit across**: one row when the bar height is Small or Standard (Standard shows slightly larger icons), two rows (12 icons) when it is Large. Mini-apps can be added too. It is only a shortcut to things on Home, so **anything that is no longer on Home (deleted, moved into a folder, or removed from the list) is removed from the widget automatically** (for a mini-app, the check is the mini-apps folder instead of Home). **Right-click** an icon to remove it from the widget, and **drag** an icon to change the order. If you rename or move the original file, the widget can no longer open it: remove it and drag it in again.
- **Clock** — time and date.
- **Frequently used** — the 5 most launched items (only launches made from this app are counted).
- **Recently opened** — the last 5 launched items.
- **Search** — filters the home icons by what you type (`/` or `Ctrl+F` to focus).
- **ToDo** — shows the next tasks and today's events from the "Planner" mini app; you can check them off and add new ones.
- **Timer** — focus 25 min / break 5 min / long break 15 min; plays a sound and brings the window to the front when done.
- **Music** (from the Music mini app) — song title, previous / play / next, volume, position.

Data used by widgets and mini apps is stored in their own folders (`data` for things to keep, `cache` for things that can be rebuilt). The "Add widget" / "Mini apps" lists show the sizes and have buttons to clear them.

## Mini apps

Apps that run inside the launcher. When opened, the **whole window becomes that app** ("‹ Home" at top left goes back). Use **＋** or right-click on the home screen → "Mini apps…" to open one or add its icon to the home screen.

Built in: **Notes** (notepad and sticky-note board), **Music** (local music player: playlists, shuffle / repeat, speed, sleep timer, media keys; playback continues when the app is closed), **Planner** (to-dos and a calendar), **Clocks & timers** (world clock, stopwatch, multiple timers, pomodoro), **Search** (find and launch anything on the home screen / registered folders), **Image viewer** (folders and slideshows), **Lucky Rush** (a slot-machine-style mini game; no real money or coins).

You can write your own with HTML / JavaScript: see [docs/extending.md](docs/extending.md) (Japanese), and copy `src/miniapps/_examples/template-app/` or `src/widgets/_examples/template-widget/` as a starting point. You can also drop a mini-app or widget folder on the window to install it.

## Desktop mode

Settings → "Window" → "Desktop mode" lets you use the launcher **instead of the desktop** (the opposite of "always on top").

- It stays behind all other windows; click it to operate it and it stays at the back.
- It is fixed maximized (the taskbar stays visible); dragging, double-clicking or Win+↓ do not move or restore it.
- The close / minimize / maximize buttons disappear; Esc, the shortcut and the tray click do not hide it.
- "Always on top" is unavailable while desktop mode is on.
- **Multiple monitors are not supported** (it fills only the monitor that holds the window).
- Turning it off returns to a normal window. To quit, use the tray menu or Settings → "Quit the app".

## Network access

- The launcher is not designed to open external sites or communicate. **The app's own code never uses the network** (it does not even depend on an HTTP client). The built-in widgets and mini apps do not use it either.
- A widget or mini app that needs the network must declare `"network": true`. A warning is shown the first time, and communication is possible only after you consent (you can revoke it in Settings → "Allowed to communicate").
- **If you consent, that widget / mini app can also load and run scripts from external https servers** ("able to communicate" means "able to bring in outside code"). Only allow things you trust.
- The UI uses a Content Security Policy that blocks loading from and talking to anything except its own files.
- The Microsoft WebView2 runtime may contact Microsoft services by itself; this is outside the app and cannot be fully stopped by it.
- Only when the standard installer runs on a PC without WebView2 does it download WebView2 from Microsoft.

## FAQ

| Question | Answer |
|---|---|
| Where is my data saved? | Settings, home icons, mini apps, widgets and logs are in `%AppData%\AlumiLauncher\` (portable: the `data` folder next to the exe). Files you put on the home screen are in `launcherFolder`. |
| Does uninstalling delete my data? | No. Removing it from Settings → Apps keeps the data. To delete everything, also delete `%AppData%\AlumiLauncher\`. |
| The shortcut key does nothing | Another app may use the same combination. Change it in Settings → "Launch". |
| I started it but no window appears | It is already running in the tray. Use the shortcut key or the tray icon. A second copy cannot be started. |
| "Windows protected your PC" appears | The installer is not code-signed yet. See [above](#about-the-smartscreen-warning). |
| I want it to start with Windows | Turn on "Start automatically with Windows" in Settings (it is off by default). |
| Something went wrong | The cause may be in `%AppData%\AlumiLauncher\logs\alumi.log`. See "Reporting" below. |

## Reporting bugs and requests

- Bugs and feature requests: GitHub **Issues** (templates are provided). **Before attaching a log, check that it contains no personal information such as file paths.**
- Questions and ideas: **Discussions**.
- Security problems: do not post them publicly; follow [SECURITY.md](SECURITY.md).
- Project process: [docs/github-workflow.md](docs/github-workflow.md) (Japanese). Release notes: [CHANGELOG.md](CHANGELOG.md).

## Contributing

Start with [docs/setup.md](docs/setup.md) (setting up the development environment), then [CONTRIBUTING_EN.md](CONTRIBUTING_EN.md) (where to change what, coding rules, checklist; the original is [CONTRIBUTING.md](CONTRIBUTING.md) in Japanese). The structure is outlined in English in [docs/architecture_EN.md](docs/architecture_EN.md). Other documents in `docs/` are in Japanese; Issues and Pull Requests in English are welcome, but the author is not comfortable reading English, so replies may be slow and some may be left unanswered for a long time (short and plain sentences help; see "About languages" in [CONTRIBUTING_EN.md](CONTRIBUTING_EN.md)). Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT License](LICENSE). Libraries used by this app (Tauri, React and others) follow their own licenses; the list and full texts are in [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md), which is also installed with the app (as `LICENSE.txt` and `THIRD_PARTY_LICENSES.md`) and included in the portable zip.

The app icon, the icons of the built-in mini-apps and the installer images were drawn in this project with code (`scripts\make-icon.ps1`, `scripts\make-installer-images.ps1` and each mini-app's `icon.svg`); no external images or illustrations are used. The text in the installer images is rendered with Noto Sans JP (SIL Open Font License 1.1); the font file itself is not distributed.
