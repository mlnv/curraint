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

let tray: Tray | null = null;
let chatWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let settings: EndpointSettings;
let isQuitting = false;

function toggleChatWindow(): void {
  if (!chatWindow) {
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
}

function showSettingsWindow(): void {
  if (!settingsWindow) {
    return;
  }

  settingsWindow.show();
  settingsWindow.focus();
}

function createTray(): void {
  const icon = createTrayIcon();

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
    isSettingsFocused: () => Boolean(settingsWindow?.isFocused())
  });
  createTray();

  registerIpcHandlers({
    getSettings: () => settings,
    saveSettings: (next) => {
      settings = saveSettings(next);
      return settings;
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  tray?.destroy();
  tray = null;
});
