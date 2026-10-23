import {
  app,
  BrowserWindow,
  dialog,
  nativeTheme,
  session,
  shell,
  type IpcMainInvokeEvent,
} from 'electron';
import * as path from 'path';
import { APP_ID, SettingsStorage, type Settings } from '@hodor/core';
import { registerIpc } from './ipc';
import { AppRunner } from './runner';
import { createTray } from './tray';
import { closeDecision } from './close-policy';
import { mainStrings } from '../shared/main-strings';
import { cliStatus, installCli } from './cli-install';

// Snow and Night frame colours, so the window never flashes the wrong theme while loading
const FRAME = { light: '#eef2f6', dark: '#0b0c0d' } as const;
const SYMBOLS = { light: '#131416', dark: '#f2f4f5' } as const;

const devServerUrl = process.env.ELECTRON_RENDERER_URL;
const rendererFile = path.join(__dirname, '../renderer/index.html');

let mainWindow: BrowserWindow | null = null;
let quitting = false;
let language = 'en';
const strings = () => mainStrings(language);
const runner = new AppRunner();

app.enableSandbox();
app.setAppUserModelId(APP_ID);

// Tests (and anyone who needs a second, isolated instance) can move Electron's data folder,
// which also scopes the single-instance lock
if (process.env.HODOR_USER_DATA) app.setPath('userData', process.env.HODOR_USER_DATA);

// One Hodor at a time: a second launch brings the existing window back
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

function showWindow(): void {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

/** Quit, asking first when templates run inside the app (their forwards stop with it) */
async function quitWithConfirm(): Promise<void> {
  const running = runner.ids().length;
  if (running > 0) {
    const s = strings().quitDialog;
    const options = {
      type: 'question' as const,
      buttons: [s.stopAndQuit, s.cancel],
      defaultId: 1,
      cancelId: 1,
      message: s.message(running),
      detail: s.detail,
    };
    const { response } = mainWindow
      ? await dialog.showMessageBox(mainWindow, options)
      : await dialog.showMessageBox(options);
    if (response !== 0) return;
  }
  quitting = true;
  await runner.shutdown();
  app.quit();
}

/** Once, on an installed build: offer to put `hodor` on the PATH (Windows does it in the installer) */
async function offerCli(): Promise<void> {
  if (!app.isPackaged || process.platform === 'win32' || !mainWindow) return;
  const settings = new SettingsStorage();
  await settings.initialize();
  if (settings.get('cliPromptShown')) return;
  if ((await cliStatus()).state !== 'missing') return;
  await settings.set('cliPromptShown', true);
  const s = strings().cliPrompt;
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: [s.install, s.notNow],
    defaultId: 0,
    cancelId: 1,
    message: s.message,
    detail: s.detail,
  });
  if (response === 0) await installCli().catch(() => undefined);
}

function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  const url = event.senderFrame?.url;
  if (!url || event.senderFrame !== mainWindow?.webContents.mainFrame) return false;
  if (devServerUrl) return url.startsWith(devServerUrl);
  return (
    url.startsWith('file://') &&
    decodeURIComponent(new URL(url).pathname).endsWith('/renderer/index.html')
  );
}

function applyTheme(settings: Pick<Settings, 'theme'>): void {
  nativeTheme.themeSource = settings.theme;
}

function frameColours() {
  const mode = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  return { background: FRAME[mode], symbols: SYMBOLS[mode] };
}

function createWindow(): void {
  const { background, symbols } = frameColours();
  const isMac = process.platform === 'darwin';

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 620,
    show: false,
    title: 'Hodor',
    // Windows and Linux take the window icon from here; macOS uses the app bundle's icon
    icon: path.join(app.getAppPath(), 'resources', 'icon.png'),
    backgroundColor: background,
    titleBarStyle: 'hidden',
    // macOS keeps its traffic lights; Windows and Linux get native controls drawn over our 48px top bar
    ...(isMac
      ? { trafficLightPosition: { x: 18, y: 17 } }
      : { titleBarOverlay: { color: background, symbolColor: symbols, height: 48 } }),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    void offerCli();
  });

  // With templates running, closing the window keeps Hodor (and the forwards) alive in the tray
  mainWindow.on('close', async (event) => {
    const decision = closeDecision(runner.ids().length, quitting, process.platform);
    if (decision === 'close') return;
    event.preventDefault();
    if (decision === 'ask') {
      // Not every Linux desktop shows tray icons: ask instead of vanishing
      const s = strings().closeDialog;
      const { response } = await dialog.showMessageBox(mainWindow!, {
        type: 'question',
        buttons: [s.keep, s.stopAndQuit, s.cancel],
        defaultId: 0,
        cancelId: 2,
        message: s.message,
        detail: s.detail,
      });
      if (response === 0) mainWindow?.hide();
      else if (response === 1) await quitWithConfirm();
      return;
    }
    mainWindow?.hide();
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // No new windows, no navigation away from the app. External links open in the browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());

  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(rendererFile);
  }
}

app.whenReady().then(async () => {
  // In development the dock shows Electron's icon unless told otherwise
  if (process.platform === 'darwin' && !app.isPackaged)
    app.dock?.setIcon(path.join(app.getAppPath(), 'resources', 'icon.png'));

  // Writing to the clipboard ("Copy address") is the only web permission Hodor needs.
  // No camera, notifications, clipboard reading or anything else.
  const allowed = new Set(['clipboard-sanitized-write']);
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) =>
    callback(allowed.has(permission))
  );
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowed.has(permission));

  const settings = new SettingsStorage();
  await settings.initialize();
  applyTheme(settings.getAll());
  language = settings.get('language');

  const services = registerIpc(
    isTrustedSender,
    (next) => {
      applyTheme(next);
      language = next.language;
      void tray.refresh();
    },
    () => mainWindow,
    runner
  );
  const tray = createTray({
    services,
    strings,
    iconDir: path.join(app.getAppPath(), 'resources'),
    showWindow,
    quit: () => void quitWithConfirm(),
  });
  runner.on('change', () => void tray.refresh());

  app.on('second-instance', showWindow);
  app.on('before-quit', (event) => {
    if (quitting) return;
    event.preventDefault();
    void quitWithConfirm();
  });

  nativeTheme.on('updated', () => {
    if (!mainWindow || process.platform === 'darwin') return;
    const { background, symbols } = frameColours();
    mainWindow.setTitleBarOverlay({ color: background, symbolColor: symbols, height: 48 });
    mainWindow.setBackgroundColor(background);
  });

  createWindow();

  app.on('activate', showWindow);
});

app.on('window-all-closed', () => {
  // The window only really closes when nothing runs; macOS keeps apps alive without windows
  if (process.platform !== 'darwin' && runner.ids().length === 0) void quitWithConfirm();
});

// Refuse webviews outright
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (event) => event.preventDefault());
});
