import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain
} from 'electron';
import type { AppSettings } from '../types';
import { IPC_CHANNELS } from '../ipc';
import { configureAppRuntime } from './runtime';
import {
  createAboutWindow,
  createChatWindow,
  createLicensesWindow,
  createSettingsWindow,
  createSessionsWindow,
  createQuickInputWindow,
  positionChatWindowNearTray,
  showQuickInputWindowCentered
} from './windows';
import { registerIpcHandlers } from './ipcHandlers';
import { loadSettings, saveSettings } from './settingsStore';
import { warmupCopilotSession } from '@curraint/core';
import { TrayManager } from './trayManager';

configureAppRuntime();

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
}

let chatWindow: BrowserWindow | null = null;
let prepareChatWindowShow: () => void = () => { /* noop until initialized */ };
let settingsWindow: BrowserWindow | null = null;
let sessionsWindow: BrowserWindow | null = null;
let aboutWindow: BrowserWindow | null = null;
let licensesWindow: BrowserWindow | null = null;
let quickInputWindow: BrowserWindow | null = null;
let settings: AppSettings;
let isQuitting = false;
const trayManager = new TrayManager({
  onToggleChat: () => toggleChatWindow(),
  onOpenSessions: () => showSessionsWindow(),
  onOpenSettings: () => showSettingsWindow(),
  onOpenAbout: () => showAboutWindow()
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

  prepareChatWindowShow();
  chatWindow.show();
  chatWindow.focus();
  trayManager.clearUnreadMessages();
}

function showSettingsWindow(): void {
  if (!isWindowUsable(settingsWindow)) {
    settingsWindow = createSettingsWindow(() => isQuitting);
  }

  settingsWindow.show();
  settingsWindow.focus();
}

function showAboutWindow(): void {
  if (!isWindowUsable(aboutWindow)) {
    aboutWindow = createAboutWindow();
  }

  aboutWindow.show();
  aboutWindow.focus();
}

function showLicensesWindow(): void {
  if (!isWindowUsable(licensesWindow)) {
    licensesWindow = createLicensesWindow();
  }

  licensesWindow.show();
  licensesWindow.focus();
}

function showSessionsWindow(): void {
  if (!isWindowUsable(sessionsWindow)) {
    sessionsWindow = createSessionsWindow(() => isQuitting);
  }

  sessionsWindow.show();
  sessionsWindow.focus();
}

let currentShortcut = '';

function broadcastShortcutResult(ok: boolean): void {
  const wins = BrowserWindow.getAllWindows();
  for (const win of wins) {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.shortcutRegistered, ok);
    }
  }
}

function registerQuickInputShortcut(shortcut: string): void {
  if (currentShortcut) {
    globalShortcut.unregister(currentShortcut);
    currentShortcut = '';
  }

  if (!shortcut.trim()) {
    broadcastShortcutResult(false);
    return;
  }

  try {
    const registered = globalShortcut.register(shortcut, () => {
      if (!isWindowUsable(quickInputWindow)) {
        return;
      }

      if (quickInputWindow.isVisible()) {
        quickInputWindow.hide();
        return;
      }

      showQuickInputWindowCentered(quickInputWindow);
    });

    if (registered) {
      currentShortcut = shortcut;
    }
    broadcastShortcutResult(registered);
  } catch {
    broadcastShortcutResult(false);
  }
}

app.whenReady().then(() => {
  settings = loadSettings();
  settingsWindow = createSettingsWindow(() => isQuitting);
  aboutWindow = createAboutWindow();
  const chatWindowHandle = createChatWindow({
    isQuitting: () => isQuitting,
    isSettingsFocused: () => isWindowFocused(settingsWindow)
  });
  chatWindow = chatWindowHandle.win;
  prepareChatWindowShow = chatWindowHandle.prepareShow;
  chatWindow.on('focus', () => {
    trayManager.clearUnreadMessages();
  });
  quickInputWindow = createQuickInputWindow();
  trayManager.create();

  registerQuickInputShortcut(settings.quickInputShortcut);

  // Pre-warm Copilot if it is already the active provider.
  if (settings.provider === 'copilot') {
    void warmupCopilotSession(settings.model, settings.systemPrompt);
  }

  registerIpcHandlers({
    getSettings: () => settings,
    saveSettings: (next) => {
      settings = saveSettings(next);
      registerQuickInputShortcut(settings.quickInputShortcut);
      if (settings.provider === 'copilot') {
        void warmupCopilotSession(settings.model, settings.systemPrompt);
      }
      // Broadcast updated settings to all windows (chat, quick-input, etc.)
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send(IPC_CHANNELS.settingsChanged, settings);
        }
      }
      return settings;
    },
    onAssistantMessage: () => {
      if (!isChatViewedByUser()) {
        trayManager.markUnreadMessage();
      }
    },
    sendToChat: (channel, data) => {
      if (isWindowUsable(chatWindow)) {
        chatWindow.webContents.send(channel, data);
      }
    },
    showChatWindow: () => {
      if (!isWindowUsable(chatWindow)) return;
      const tray = trayManager.getTray();
      if (tray) positionChatWindowNearTray(tray, chatWindow);
      prepareChatWindowShow();
      chatWindow.show();
      chatWindow.focus();
      trayManager.clearUnreadMessages();
    }
  });

  ipcMain.handle(IPC_CHANNELS.sessionsOpen, () => showSessionsWindow());

  ipcMain.handle(IPC_CHANNELS.openLicensesWindow, () => showLicensesWindow());

  ipcMain.handle(IPC_CHANNELS.quickInputSubmit, (_event, message: string) => {
    if (isWindowUsable(quickInputWindow)) {
      quickInputWindow.hide();
    }

    if (!isWindowUsable(chatWindow)) {
      return;
    }

    const tray = trayManager.getTray();
    if (tray) {
      positionChatWindowNearTray(tray, chatWindow);
    }

    prepareChatWindowShow();
    chatWindow.show();
    chatWindow.focus();
    trayManager.clearUnreadMessages();
    chatWindow.webContents.send(IPC_CHANNELS.receiveQuickInput, message);
  });

  ipcMain.handle(IPC_CHANNELS.quickInputClose, () => {
    if (isWindowUsable(quickInputWindow)) {
      quickInputWindow.hide();
    }
  });

  ipcMain.handle(IPC_CHANNELS.chatWindowHide, () => {
    if (isWindowUsable(chatWindow)) {
      chatWindow.hide();
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

    prepareChatWindowShow();
    chatWindow.show();
    chatWindow.focus();
    trayManager.clearUnreadMessages();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  trayManager.destroy();
  globalShortcut.unregisterAll();
});
