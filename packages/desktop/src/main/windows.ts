import { BrowserWindow, screen, type Tray } from 'electron';
import { join } from 'path';

const WINDOW_SIZES = {
  chat: { width: 380, height: 520 },
  settings: { width: 560, height: 560 },
  quickInput: { width: 620, height: 72 },
  about: { width: 400, height: 320 }
} as const;

const CHAT_OFFSET = 8;

type WindowVisibilityContext = {
  isQuitting: () => boolean;
  isSettingsFocused: () => boolean;
};

const isDebug = process.env['CURRAINT_DEBUG'] === '1';

export function createChatWindow(context: WindowVisibilityContext): {
  win: BrowserWindow;
  prepareShow: () => void;
} {
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
  if (isDebug) { win.webContents.openDevTools({ mode: 'detach' }); }
  win.on('close', (event) => {
    if (context.isQuitting()) {
      return;
    }

    event.preventDefault();
    win.hide();
  });

  // On Windows, alwaysOnTop+skipTaskbar windows don't reliably receive focus
  // after show(). This means blur can fire BEFORE the show event, so we
  // stamp the time BEFORE calling show() via prepareShow() rather than
  // inside the 'show' event — ensuring the guard is already armed.
  let lastShownAt = 0;
  const MIN_VISIBLE_MS = 500;

  const prepareShow = (): void => {
    lastShownAt = Date.now();
  };

  win.on('blur', () => {
    if (context.isSettingsFocused()) {
      return;
    }
    const elapsed = Date.now() - lastShownAt;
    if (elapsed < MIN_VISIBLE_MS) {
      // Blur fired during the guard window (e.g. Windows steals focus after
      // installer launch). Schedule a deferred hide so the window doesn't get
      // stuck visible-but-unfocused.
      const remaining = MIN_VISIBLE_MS - elapsed;
      setTimeout(() => {
        if (!win.isDestroyed() && !win.isFocused() && !context.isSettingsFocused()) {
          win.hide();
        }
      }, remaining + 50);
      return;
    }
    if (!win.isDestroyed()) {
      win.hide();
    }
  });

  return { win, prepareShow };
}

export function createSettingsWindow(isQuitting: () => boolean): BrowserWindow {
  const win = new BrowserWindow({
    width: WINDOW_SIZES.settings.width,
    height: WINDOW_SIZES.settings.height,
    minWidth: WINDOW_SIZES.settings.width,
    minHeight: WINDOW_SIZES.settings.height,
    show: false,
    autoHideMenuBar: true,
    resizable: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  void win.loadFile(join(__dirname, '../renderer/settings.html'));
  if (isDebug) { win.webContents.openDevTools({ mode: 'detach' }); }
  win.on('close', (event) => {
    if (isQuitting()) {
      return;
    }

    event.preventDefault();
    win.hide();
  });

  return win;
}

export function createSessionsWindow(isQuitting: () => boolean): BrowserWindow {
  const win = new BrowserWindow({
    width: 560,
    height: 520,
    show: false,
    autoHideMenuBar: true,
    resizable: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  void win.loadFile(join(__dirname, '../renderer/sessions.html'));
  if (isDebug) { win.webContents.openDevTools({ mode: 'detach' }); }
  win.on('close', (event) => {
    if (isQuitting()) {
      return;
    }

    event.preventDefault();
    win.hide();
  });

  return win;
}

export function createAboutWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: WINDOW_SIZES.about.width,
    height: WINDOW_SIZES.about.height,
    show: false,
    autoHideMenuBar: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  void win.loadFile(join(__dirname, '../renderer/about.html'));
  return win;
}

export function createQuickInputWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: WINDOW_SIZES.quickInput.width,
    height: WINDOW_SIZES.quickInput.height,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    minimizable: false,
    maximizable: false,
    resizable: false,
    center: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  void win.loadFile(join(__dirname, '../renderer/quick-input.html'));

  win.on('blur', () => {
    win.hide();
  });

  return win;
}

export function showQuickInputWindowCentered(win: BrowserWindow): void {
  const display = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = display.workArea;
  const { width, height } = win.getBounds();
  const x = Math.round(display.workArea.x + (screenWidth - width) / 2);
  const y = Math.round(display.workArea.y + screenHeight * 0.3);
  win.setPosition(x, y, false);
  win.show();
  win.focus();
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
