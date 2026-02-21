import { BrowserWindow, screen, type Tray } from 'electron';
import { join } from 'path';

const WINDOW_SIZES = {
  chat: { width: 380, height: 520 },
  settings: { width: 480, height: 420 }
} as const;

const CHAT_OFFSET = 8;

type WindowVisibilityContext = {
  isQuitting: () => boolean;
  isSettingsFocused: () => boolean;
};

export function createChatWindow(context: WindowVisibilityContext): BrowserWindow {
  const win = new BrowserWindow({
    width: WINDOW_SIZES.chat.width,
    height: WINDOW_SIZES.chat.height,
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

  void win.loadFile(join(__dirname, '../renderer/index.html'));
  win.on('close', (event) => {
    if (context.isQuitting()) {
      return;
    }

    event.preventDefault();
    win.hide();
  });

  win.on('blur', () => {
    if (!context.isSettingsFocused()) {
      win.hide();
    }
  });

  return win;
}

export function createSettingsWindow(isQuitting: () => boolean): BrowserWindow {
  const win = new BrowserWindow({
    width: WINDOW_SIZES.settings.width,
    height: WINDOW_SIZES.settings.height,
    show: false,
    autoHideMenuBar: true,
    resizable: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  void win.loadFile(join(__dirname, '../renderer/settings.html'));
  win.on('close', (event) => {
    if (isQuitting()) {
      return;
    }

    event.preventDefault();
    win.hide();
  });

  return win;
}

export function positionChatWindowNearTray(
  tray: Tray,
  chatWindow: BrowserWindow
): void {
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
    ? trayBounds.y + trayBounds.height + CHAT_OFFSET
    : trayBounds.y - windowBounds.height - CHAT_OFFSET;
  y = Math.max(area.y, Math.min(y, area.y + area.height - windowBounds.height));

  chatWindow.setPosition(x, y, false);
}
