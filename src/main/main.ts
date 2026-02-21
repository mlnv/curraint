import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  screen,
  Tray,
  nativeImage
} from 'electron';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { ChatMessage, EndpointSettings } from '../common/types';
import { chatCompletion } from '../common/openaiCompatibleClient';
import { loadSettings, saveSettings } from './settingsStore';

const sessionDataPath = join(app.getPath('temp'), 'flowai-session-data');
if (!existsSync(sessionDataPath)) {
  mkdirSync(sessionDataPath, { recursive: true });
}
app.setPath('sessionData', sessionDataPath);
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-http-cache');

let tray: Tray | null = null;
let chatWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let settings: EndpointSettings;

function createChatWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 380,
    height: 520,
    show: false,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    minimizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    resizable: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(join(__dirname, '../renderer/index.html'));
  win.on('blur', () => {
    if (!settingsWindow?.isFocused()) {
      win.hide();
    }
  });

  return win;
}

function positionChatWindowNearTray(): void {
  if (!tray || !chatWindow) {
    return;
  }

  const trayBounds = tray.getBounds();
  const windowBounds = chatWindow.getBounds();
  const display = screen.getDisplayNearestPoint({
    x: trayBounds.x,
    y: trayBounds.y
  });
  const area = display.workArea;

  const centerX = trayBounds.x + Math.round(trayBounds.width / 2);
  let x = centerX - Math.round(windowBounds.width / 2);
  x = Math.max(area.x, Math.min(x, area.x + area.width - windowBounds.width));

  const isTopTray = trayBounds.y <= area.y + Math.round(area.height / 2);
  let y = isTopTray
    ? trayBounds.y + trayBounds.height + 8
    : trayBounds.y - windowBounds.height - 8;
  y = Math.max(area.y, Math.min(y, area.y + area.height - windowBounds.height));

  chatWindow.setPosition(x, y, false);
}

function createSettingsWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 480,
    height: 420,
    show: false,
    autoHideMenuBar: true,
    resizable: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(join(__dirname, '../renderer/settings.html'));
  win.on('close', (event) => {
    event.preventDefault();
    win.hide();
  });

  return win;
}

function toggleChatWindow(): void {
  if (!chatWindow) {
    return;
  }

  if (chatWindow.isVisible()) {
    chatWindow.hide();
    return;
  }

  positionChatWindowNearTray();
  chatWindow.show();
  chatWindow.focus();
}

function showSettingsWindow(): void {
  if (!settingsWindow) {
    return;
  }

  settingsWindow.show();
  settingsWindow.focus();
}

function createTray(): void {
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAQ0lEQVR42mNgGAXUBv7//z8DA8M/DAwM/4eHh5GRkf8fHx9jY2P/Dw8P4+Pj/8fHx7+/v/////x8fH2NjY////f4YBhA0AAPUlCg+xOtS4AAAAAElFTkSuQmCC'
  );

  tray = new Tray(icon);
  tray.setToolTip('FlowAI');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Chat', click: () => toggleChatWindow() },
    { label: 'Settings', click: () => showSettingsWindow() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => toggleChatWindow());
}

function registerIpc(): void {
  ipcMain.handle('settings:get', () => settings);

  ipcMain.handle('settings:save', (_event, next: EndpointSettings) => {
    settings = saveSettings(next);
    return settings;
  });

  ipcMain.handle('chat:send', async (_event, messages: ChatMessage[]) => {
    const composed: ChatMessage[] = settings.systemPrompt
      ? [{ role: 'system', content: settings.systemPrompt }, ...messages]
      : messages;

    const result = await chatCompletion(settings, composed);
    return result.message;
  });
}

app.whenReady().then(() => {
  settings = loadSettings();
  chatWindow = createChatWindow();
  settingsWindow = createSettingsWindow();
  createTray();
  registerIpc();
});

app.on('before-quit', () => {
  tray?.destroy();
  tray = null;
});
