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

// Snow and Night frame colours, so the window never flashes the wrong theme while loading
const FRAME = { light: '#eef2f6', dark: '#0b0c0d' } as const;
const SYMBOLS = { light: '#131416', dark: '#f2f4f5' } as const;

const devServerUrl = process.env.ELECTRON_RENDERER_URL;
const rendererFile = path.join(__dirname, '../renderer/index.html');

let mainWindow: BrowserWindow | null = null;
let quitting = false;
const runner = new AppRunner();

app.enableSandbox();
app.setAppUserModelId(APP_ID);

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
    const options = {
      type: 'question' as const,
      buttons: ['Stop and quit', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      message:
        running === 1
          ? 'A template is running. Stop it and quit?'
          : `${running} templates are running. Stop them and quit?`,
      detail:
        'Their port-forwards close when Hodor quits. Templates started from the terminal keep running.',
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

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  // With templates running, closing the window keeps Hodor (and the forwards) alive in the tray
  mainWindow.on('close', async (event) => {
    const decision = closeDecision(runner.ids().length, quitting, process.platform);
    if (decision === 'close') return;
    event.preventDefault();
    if (decision === 'ask') {
      // Not every Linux desktop shows tray icons: ask instead of vanishing
      const { response } = await dialog.showMessageBox(mainWindow!, {
        type: 'question',
        buttons: ['Keep running in the background', 'Stop and quit', 'Cancel'],
        defaultId: 0,
        cancelId: 2,
        message: 'Templates are running',
        detail:
          'Keep their port-forwards open in the background? You can get back to Hodor from its tray icon or by opening it again.',
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

  const services = registerIpc(
    isTrustedSender,
    (next) => applyTheme(next),
    () => mainWindow,
    runner
  );
  const tray = createTray({
    services,
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
