import { type OpenFolder } from "./modules/folders/FolderModel";
import { RenameDialog } from "./modules/folders/RenameDialog";
import { useFolderActions } from "./modules/folders/useFolderActions";
import { type HomeEntry } from "./modules/home/HomeModel";
import { HomeScreen } from "./modules/home/HomeScreen";
import { resetIcons } from "./modules/icons/IconController";
import { MiniAppHost } from "./modules/miniapps/miniapp";
import { SettingsPanel } from "./modules/settings/SettingsPanel";
import { AppWidgetBar } from "./modules/widgets/AppWidgetBar";
import {
  type FolderEntry,
  type Item,
  type ModWidget,
  api,
  widgetConsentKey,
  widgetKey,
  widgetLabel,
} from "./shared/api/ApiModel";
import { t } from "./shared/i18n/i18n";
import { useUndoHistory } from "./modules/history/useUndoHistory";
import { useDragHandover } from "./modules/home/useDragHandover";
import { useExplorerDrop } from "./modules/home/useExplorerDrop";
import { useHomeEntries } from "./modules/home/useHomeEntries";
import { useHomeSearch } from "./modules/home/useHomeSearch";
import { useStorageManagement } from "./modules/miniapps/useStorageManagement";
import { useMiniApps } from "./modules/miniapps/useMiniApps";
import { normalizeSettings } from "./modules/settings/normalizeSettings";
import { themeVarsOf } from "./modules/settings/ThemeModel";
import { useSettingsActions } from "./modules/settings/useSettingsActions";
import { appClassName, layoutsOf } from "./modules/shell/AppLookModel";
import { ConsentDialog } from "./modules/shell/ConsentDialog";
import { ContextMenu } from "./modules/shell/ContextMenu";
import { CornerButtons } from "./modules/shell/CornerButtons";
import { DeleteDialog } from "./modules/shell/DeleteDialog";
import { Pickers } from "./modules/shell/Pickers";
import { PresetSwitcher } from "./modules/shell/PresetSwitcher";
import { TitleBar } from "./modules/shell/TitleBar";
import { useAppEffects } from "./modules/shell/useAppEffects";
import { useAppServices } from "./modules/shell/useAppServices";
import { useAppKeys } from "./modules/shell/useAppKeys";
import { usePickers } from "./modules/shell/usePickers";
import { usePlusButton } from "./modules/shell/usePlusButton";
import { useConfigStore } from "./modules/shell/useConfigStore";
import { useToast } from "./modules/shell/useToast";
import { useWindowMode } from "./modules/shell/useWindowMode";
import { useWidgetBars } from "./modules/widgets/useWidgetBars";
import { useWidgetEnv } from "./modules/widgets/useWidgetEnv";
import { useWidgetList } from "./modules/widgets/useWidgetList";
import { type MenuAction, type MenuState } from "./shared/ui/MenuModel";
import { useCallback, useRef, useState } from "react";

/**
 * アプリ全体の画面。ホーム(フォルダとアイコンの一覧)・ヘッダー/フッターのウィジェット・フォルダを開いた画面・設定・ミニアプリ・各ダイアログを、組み合わせて並べる。
 *
 * 処理のほとんどは、機能ごとのフック(`modules/` の下の `use○○`)と、ホーム画面(`HomeScreen`)に分けてあり、ここでは、それらをつなぐ。
 *   設定の保存 `useConfigStore` / 設定の変更 `useSettingsActions` / フォルダの操作 `useFolderActions`
 *   元に戻す `useUndoHistory` / ミニアプリ `useMiniApps` / ホームの検索 `useHomeSearch`
 *   ヘッダー・フッター `useWidgetBars` / ドラッグ `useDragHandover`・`useExplorerDrop` / キー操作 `useGlobalKeys`
 * 設定は `configRef`(常に最新)に対して変更を適用する(`mutate`)ので、非同期の途中で設定が変わっても、古い内容で上書きしない。
 */
export function App() {
  const { config, setConfig, configRef, mutate } = useConfigStore();
  const settings = normalizeSettings(config);
  const { toast, flash } = useToast();
  const { compact, smallWin, maximized } = useWindowMode();

  // ---- 画面の状態(何を開いているか) ----
  const [open, setOpen] = useState<OpenFolder | null>(null);
  const [renaming, setRenaming] = useState<FolderEntry | null>(null);
  const [deleting, setDeleting] = useState<Item | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  /** 全体の再読み込みの番号。変わると、すべての一覧を取り直す。 */
  const [reload, setReload] = useState(0);
  const [launcherPath, setLauncherPath] = useState("");
  const launcherRef = useRef("");
  launcherRef.current = launcherPath;
  /** イベントの中から、最新の `open` と `config` を読むための参照(購読し直さなくて済むように)。 */
  const stateRef = useRef({ open, config });
  stateRef.current = { open, config };
  /** いまのホームの並び(下で `entries` が決まったら入れる)。 */
  const entriesRef = useRef<HomeEntry[]>([]);

  const { mods, modsLoaded, refreshMods } = useWidgetList();

  // ---- 元に戻す(Ctrl+Z)/ やり直し(Ctrl+Y)(機能は modules/history) ----
  const history = useUndoHistory({ configRef, mutate, onRestored: () => setReload((k) => k + 1), flash });
  const { snapshot, restoreSnapshot, pushHistory, clearHistory, flushReorder, reorderRecorded } = history;

  // ---- フォルダ・アイコンの操作(機能は modules/folders) ----
  const folderActions = useFolderActions({
    configRef,
    mutate,
    flash,
    launcherRef,
    setLauncherPath,
    stateRef,
    entriesRef,
    setOpen,
    setRenaming,
    setDeleting,
    reload,
    history,
  });
  const { bumpFolder, tickFor, addFolder, pickAndAddFolder, renameFolder, deleteItem, addPaths } = folderActions;

  // ---- ミニアプリ(機能は modules/miniapps) ----
  const miniApps = useMiniApps({ configRef, mutate, flash, launcherRef, setLauncherPath, bumpFolder, entriesRef });
  const { miniOpen, setMiniOpen, refreshMinis, pickingMini, setPickingMini, consent, setConsent } = miniApps;
  // ウィジェット・ミニアプリごとの、データ・キャッシュの大きさと消去
  const storageMgmt = useStorageManagement({
    flash,
    closeMiniFor: (tg) =>
      setMiniOpen((cur) => (cur && (!tg || (tg.kind === "miniapp" && cur.id === tg.id)) ? null : cur)),
  });

  /**
   * アイコンと一覧のキャッシュを捨てて、すべて読み直す(ウィジェットとミニアプリの一覧も)。
   * @param silent `true` なら、「再読み込みしました」の通知を出さない
   */
  const reloadAll = useCallback(
    async (silent = false) => {
      resetIcons();
      void refreshMods();
      void refreshMinis();
      setReload((k) => k + 1);
      if (!silent) flash(t("reloaded"));
    },
    [flash, refreshMods, refreshMinis],
  );

  // ---- 検索ウィジェット: ホームのアイコンを名前で絞り込む(機能は modules/home) ----
  const { query, setQuery, q, entryMatches, onSearchEnter } = useHomeSearch(entriesRef, setOpen);

  // ---- 設定の変更・見た目(機能は modules/settings) ----
  const {
    accent,
    setAccent,
    bgImage,
    setBgImage,
    changeSettings,
    changeHotkey,
    applyPresetMode,
    pickImage,
    autostart,
    changeAutostart,
    confirmReset,
    resetSettings,
  } = useSettingsActions({
    config,
    settings,
    configRef,
    setConfig,
    mutate,
    flash,
    reloadAll,
    flushReorder,
    clearHistory,
    setOpen,
    setMenu,
    setLauncherPath,
    showSettings,
  });

  // ---- 音量・ツールチップ・起動時の復元・Rust 側からの通知 ----
  useAppServices(config, mutate, bumpFolder, flash);
  // エクスプローラーからのドラッグ&ドロップ
  useExplorerDrop({ stateRef, flash, addPaths, addFolder, refreshMods, refreshMinis, setLauncherPath, bumpFolder });
  // 起動時の読み込み・メニューを閉じる・フォルダが消えたら閉じる・ウィジェットからのフォルダの要求
  useAppEffects({
    config,
    configRef,
    setConfig,
    setBgImage,
    setAccent,
    setLauncherPath,
    menu,
    setMenu,
    showSettings,
    setShowSettings,
    open,
    setOpen,
    flash,
  });

  // ---- 追加の画面(ウィジェット・ミニアプリ・スタートメニュー)とキー操作 ----
  const pickers = usePickers({
    pickingMini,
    setPickingMini,
    refreshMods,
    refreshMinis,
    refreshStorage: storageMgmt.refreshStorage,
  });
  useAppKeys({
    on: {
      folderOpen: !!open,
      renaming: !!renaming,
      deleting: !!deleting,
      miniOpen: !!miniOpen,
      picking: pickers.anyPicking,
      menu: !!menu,
      settings: showSettings,
    },
    settings,
    close: {
      mini: () => setMiniOpen(null),
      pickers: pickers.closeAll,
      menu: () => setMenu(null),
      settings: () => setShowSettings(false),
    },
    reloadAll,
    applyPresetMode,
  });

  /**
   * 右クリックメニューを出す。
   * @param x 画面の x 座標
   * @param y 画面の y 座標
   * @param actions 項目
   */
  const showMenu = useCallback((x: number, y: number, actions: MenuAction[]) => setMenu({ x, y, actions }), []);

  // ---- ヘッダー・フッターのウィジェット(機能は modules/widgets) ----
  const widgets = useWidgetBars({ settings, mods, changeSettings, flash, showMenu });
  const { widgetDragging } = widgets;

  // ---- 右下の「＋」 ----
  const onPlus = usePlusButton({ config, open, showMenu, addPaths, pickAndAddFolder, pickers });

  // ---- ホームに並べるもの(フォルダ + ホームに直接置いたショートカット。並びはドラッグで変えた順) ----
  const { entries, homeKeys } = useHomeEntries(config, launcherPath, tickFor(launcherPath));
  entriesRef.current = entries;
  // ショートカットウィジェットが、ホーム・ミニアプリのフォルダから無くなったものを外すための情報(読み込めるまでは null)
  const minis = miniApps.minisLoaded ? miniApps.minis : null;
  const widgetEnv = useWidgetEnv({ query, setQuery, onSearchEnter, flash, showMenu, config, tickFor, homeKeys, minis });

  // ---- ホームとフォルダ内の間の、アイコンの受け渡しのドラッグ(機能は modules/home) ----
  const handover = useDragHandover({
    stateRef,
    configRef,
    launcherRef,
    entriesRef,
    open,
    setOpen,
    mutate,
    flash,
    bumpFolder,
    flushReorder,
    snapshot,
    restoreSnapshot,
    pushHistory,
  });

  // ---- 見た目(レイアウト・テーマの CSS 変数) ----
  const { home: homeLayout, modal: modalLayout } = layoutsOf(settings, compact);
  /** テーマ・UI の色・透過度・アイコンの大きさ・ぼかしなどを、CSS の変数として、画面の最上位に渡す。 */
  const themeVars = themeVarsOf(settings, accent, homeLayout.size, homeLayout.gap, bgImage);
  const barsOn = !smallWin && !compact;
  // ウィジェットを動かしている間は、空のヘッダー・フッターも出して、置き場所にできるようにする
  // 削除されたウィジェット(一覧にない ID)は、欄に空きだけ残さないよう、数えない(設定には残すので、フォルダを戻せば、また出る)
  const existing = (ids: string[]) => (modsLoaded ? ids.filter((id) => mods.some((m) => widgetKey(m) === id)) : ids);
  const showHeader =
    barsOn && ((settings.headerEnabled && existing(settings.headerWidgets).length > 0) || widgetDragging);
  const showFooter =
    barsOn && ((settings.footerEnabled && existing(settings.footerWidgets).length > 0) || widgetDragging);

  /** ヘッダーとフッターの帯に、共通で渡すもの。 */
  const barProps = {
    settings,
    widgets,
    mods,
    modsLoaded,
    env: widgetEnv,
    onAskNetwork: (m: ModWidget) => setConsent({ name: widgetLabel(m), key: widgetConsentKey(m), web: false }),
  };

  return (
    <div
      className={appClassName(settings, {
        compact,
        maximized,
        miniOpen: !!miniOpen,
        blurBehind: !!open && !handover.leaving,
      })}
      style={themeVars}
    >
      {settings.presetsEnabled && (
        <PresetSwitcher
          count={settings.presetCount}
          current={settings.preset}
          onSelect={(n) => applyPresetMode(true, n)}
        />
      )}

      <TitleBar maximized={maximized} />

      {/* 上の帯(トップ): プリセットと、ウィンドウのボタンが並ぶ場所。ヘッダーは、この下 */}
      <div className="band band-top" aria-hidden="true" />

      {showHeader && <AppWidgetBar bar="header" {...barProps} />}

      <HomeScreen
        config={config}
        settings={settings}
        entries={entries}
        q={q}
        entryMatches={entryMatches}
        open={open}
        setOpen={setOpen}
        miniOpen={!!miniOpen}
        homeLayout={homeLayout}
        modalLayout={modalLayout}
        actions={folderActions}
        handover={handover}
        reorderRecorded={reorderRecorded}
        mutate={mutate}
        configRef={configRef}
        entriesRef={entriesRef}
        stateRef={stateRef}
        launcherRef={launcherRef}
        flash={flash}
        showMenu={showMenu}
        setRenaming={setRenaming}
        setDeleting={setDeleting}
      />

      {showFooter && <AppWidgetBar bar="footer" {...barProps} />}

      {/* 下の帯(ボトム): ＋・再読み込み・設定のボタンが並ぶ場所。フッターは、この上 */}
      <div className="band band-bottom" aria-hidden="true" />

      <CornerButtons
        folderOpen={!!open}
        settingsOpen={showSettings}
        onPlus={onPlus}
        onReload={() => reloadAll()}
        onToggleSettings={() => setShowSettings((v) => !v)}
      />

      {showSettings && (
        <SettingsPanel
          settings={settings}
          hasImage={bgImage !== null}
          onChange={changeSettings}
          onApplySize={(w, h) => !settings.desktopMode && api.setWindowSize(w, h)}
          onPickImage={pickImage}
          autostart={autostart}
          onAutostart={changeAutostart}
          confirmReset={confirmReset}
          onReset={resetSettings}
          onHotkey={changeHotkey}
          onPresetsEnabled={(enabled) => applyPresetMode(enabled, settings.preset)}
          onPresetCount={(n) => applyPresetMode(true, Math.min(settings.preset, n), n)}
        />
      )}

      {consent && (
        <ConsentDialog consent={consent} onCancel={() => setConsent(null)} onAllow={miniApps.confirmConsent} />
      )}

      <Pickers
        picking={pickers.picking}
        close={pickers.close}
        settings={settings}
        mods={mods}
        widgets={widgets}
        miniApps={miniApps}
        storage={storageMgmt}
        flash={flash}
        onStartAdded={(path, name) => {
          // ホームの表示を更新する(追加したショートカットが、アイコンとして並ぶ)
          setLauncherPath(path);
          bumpFolder(path);
          flash(t("addedToHome", { n: 1 }) + ` (${name})`);
        }}
      />

      {miniOpen && (
        <MiniAppHost key={miniOpen.id} app={miniOpen} env={miniApps.miniEnv} onClose={() => setMiniOpen(null)} />
      )}

      {renaming && (
        <RenameDialog
          folder={renaming}
          onSave={(name) => renameFolder(renaming.id, name)}
          onCancel={() => setRenaming(null)}
        />
      )}

      {deleting && <DeleteDialog item={deleting} onCancel={() => setDeleting(null)} onConfirm={deleteItem} />}

      {toast && <div className="toast">{toast}</div>}

      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
    </div>
  );
}
