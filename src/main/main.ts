import {
  app,
  BrowserWindow
} from 'electron';
import type { EndpointSettings } from '../common/types';
import { configureAppRuntime } from './runtime';
import {
  createChatWindow,
  createSettingsWindow,
  positionChatWindowNearTray
} from './windows';
import { registerIpcHandlers } from './ipcHandlers';
import { loadSettings, saveSettings } from './settingsStore';
import { TrayManager } from './trayManager';

configureAppRuntime();

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
}

let chatWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let settings: EndpointSettings;
let isQuitting = false;
const trayManager = new TrayManager({
  onToggleChat: () => toggleChatWindow(),
  onOpenSettings: () => showSettingsWindow()
});

function isWindowUsable(window: BrowserWindow | null): window is BrowserWindow {
  return window !== null && !window.isDestroyed();
}

function isWindowFocused(window: BrowserWindow | null): boolean {
  return isWindowUsable(window) ? window.isFocused() : false;
}

function isChatViewedByUser(): boolean {
  return (
    isWindowUsable(chatWindow) &&
    chatWindow.isVisible() &&
    chatWindow.isFocused()
  );
}

function toggleChatWindow(): void {
  if (!isWindowUsable(chatWindow)) {
    return;
  }

  if (chatWindow.isVisible()) {
    chatWindow.hide();
    return;
  }

  const tray = trayManager.getTray();
  if (tray) {
    positionChatWindowNearTray(tray, chatWindow);
  }

  chatWindow.show();
  chatWindow.focus();
  trayManager.clearUnreadMessages();
}

function showSettingsWindow(): void {
  if (!isWindowUsable(settingsWindow)) {
    return;
  }

  settingsWindow.show();
  settingsWindow.focus();
}

app.whenReady().then(() => {
  settings = loadSettings();
  settingsWindow = createSettingsWindow(() => isQuitting);
  chatWindow = createChatWindow({
    isQuitting: () => isQuitting,
    isSettingsFocused: () => isWindowFocused(settingsWindow)
  });
  chatWindow.on('focus', () => {
    trayManager.clearUnreadMessages();
  });
  trayManager.create();

  registerIpcHandlers({
    getSettings: () => settings,
    saveSettings: (next) => {
      settings = saveSettings(next);
      return settings;
    },
    onAssistantMessage: () => {
      if (!isChatViewedByUser()) {
        trayManager.markUnreadMessage();
      }
    }
  });
});

app.on('second-instance', () => {
  if (!hasSingleInstanceLock) {
    return;
  }

  if (isWindowUsable(chatWindow)) {
    const tray = trayManager.getTray();
    if (tray) {
      positionChatWindowNearTray(tray, chatWindow);
    }

    chatWindow.show();
    chatWindow.focus();
    trayManager.clearUnreadMessages();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  trayManager.destroy();
});
