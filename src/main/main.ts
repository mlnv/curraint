import {
  app,
  BrowserWindow,
  Menu,
  type MenuItemConstructorOptions,
  Tray
} from 'electron';
import type { EndpointSettings } from '../common/types';
import { createTrayIcon } from './trayIcon';
import { configureAppRuntime } from './runtime';
import {
  createChatWindow,
  createSettingsWindow,
  positionChatWindowNearTray
} from './windows';
import { registerIpcHandlers } from './ipcHandlers';
import { loadSettings, saveSettings } from './settingsStore';

configureAppRuntime();

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
}

let tray: Tray | null = null;
let chatWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let settings: EndpointSettings;
let isQuitting = false;
let hasUnreadAssistantMessage = false;
let unreadAssistantCount = 0;

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

function refreshTrayIcon(): void {
  if (!tray) {
    return;
  }

  tray.setImage(createTrayIcon(hasUnreadAssistantMessage));
  if (unreadAssistantCount > 0) {
    tray.setToolTip(`FlowAI (${unreadAssistantCount} new)`);
  } else {
    tray.setToolTip('FlowAI');
  }
}

function setUnreadAssistantMessage(value: boolean): void {
  if (hasUnreadAssistantMessage === value) {
    refreshTrayIcon();
    return;
  }

  hasUnreadAssistantMessage = value;
  refreshTrayIcon();
}

function clearUnreadAssistantMessages(): void {
  unreadAssistantCount = 0;
  setUnreadAssistantMessage(false);
}

function incrementUnreadAssistantMessages(): void {
  unreadAssistantCount += 1;
  setUnreadAssistantMessage(true);
}

function toggleChatWindow(): void {
  if (!isWindowUsable(chatWindow)) {
    return;
  }

  if (chatWindow.isVisible()) {
    chatWindow.hide();
    return;
  }

  if (tray) {
    positionChatWindowNearTray(tray, chatWindow);
  }

  chatWindow.show();
  chatWindow.focus();
  clearUnreadAssistantMessages();
}

function showSettingsWindow(): void {
  if (!isWindowUsable(settingsWindow)) {
    return;
  }

  settingsWindow.show();
  settingsWindow.focus();
}

function createTray(): void {
  const icon = createTrayIcon(hasUnreadAssistantMessage);

  tray = new Tray(icon);
  tray.setToolTip('FlowAI');

  const template: MenuItemConstructorOptions[] = [
    { label: 'Open Chat', click: () => toggleChatWindow() },
    { label: 'Settings', click: () => showSettingsWindow() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ];

  const contextMenu = Menu.buildFromTemplate(template);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => toggleChatWindow());
}

app.whenReady().then(() => {
  settings = loadSettings();
  settingsWindow = createSettingsWindow(() => isQuitting);
  chatWindow = createChatWindow({
    isQuitting: () => isQuitting,
    isSettingsFocused: () => isWindowFocused(settingsWindow)
  });
  chatWindow.on('focus', () => {
    clearUnreadAssistantMessages();
  });
  createTray();

  registerIpcHandlers({
    getSettings: () => settings,
    saveSettings: (next) => {
      settings = saveSettings(next);
      return settings;
    },
    onAssistantMessage: () => {
      if (!isChatViewedByUser()) {
        incrementUnreadAssistantMessages();
      }
    }
  });
});

app.on('second-instance', () => {
  if (!hasSingleInstanceLock) {
    return;
  }

  if (isWindowUsable(chatWindow)) {
    if (tray) {
      positionChatWindowNearTray(tray, chatWindow);
    }

    chatWindow.show();
    chatWindow.focus();
    clearUnreadAssistantMessages();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  tray?.destroy();
  tray = null;
});
