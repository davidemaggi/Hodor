import { app, BrowserWindow, nativeTheme, session, shell, type IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import { SettingsStorage, type Settings } from '@hodor/core';
import { registerIpc } from './ipc';

// Snow and Night frame colours, so the window never flashes the wrong theme while loading
const FRAME = { light: '#eef2f6', dark: '#0b0c0d' } as const;
const SYMBOLS = { light: '#131416', dark: '#f2f4f5' } as const;

const devServerUrl = process.env.ELECTRON_RENDERER_URL;
const rendererFile = path.join(__dirname, '../renderer/index.html');

let mainWindow: BrowserWindow | null = null;

app.enableSandbox();

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

  registerIpc(
    isTrustedSender,
    (next) => applyTheme(next),
    () => mainWindow
  );

  nativeTheme.on('updated', () => {
    if (!mainWindow || process.platform === 'darwin') return;
    const { background, symbols } = frameColours();
    mainWindow.setTitleBarOverlay({ color: background, symbolColor: symbols, height: 48 });
    mainWindow.setBackgroundColor(background);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Refuse webviews outright
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (event) => event.preventDefault());
});
