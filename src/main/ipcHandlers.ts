import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../common/ipc';
import {
  chatCompletion,
  testConnection
} from '../common/openaiCompatibleClient';
import { composeConversation, normalizeSettings } from '../common/settings';
import type { ChatMessage, EndpointSettings } from '../common/types';

type SettingsAccess = {
  getSettings: () => EndpointSettings;
  saveSettings: (next: EndpointSettings) => EndpointSettings;
  onAssistantMessage?: () => void;
};

function isChatMessageArray(messages: unknown): messages is ChatMessage[] {
  if (!Array.isArray(messages)) {
    return false;
  }

  return messages.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      'role' in item &&
      'content' in item &&
      typeof (item as { role: unknown }).role === 'string' &&
      typeof (item as { content: unknown }).content === 'string'
  );
}

export function registerIpcHandlers(settingsAccess: SettingsAccess): void {
  ipcMain.handle(IPC_CHANNELS.getSettings, () => settingsAccess.getSettings());

  ipcMain.handle(IPC_CHANNELS.saveSettings, (_event, next: EndpointSettings) => {
    return settingsAccess.saveSettings(next);
  });

  ipcMain.handle(IPC_CHANNELS.chatSend, async (_event, messages: unknown) => {
    if (!isChatMessageArray(messages)) {
      throw new Error('Invalid chat payload.');
    }

    const settings = settingsAccess.getSettings();
    const composed = composeConversation(settings, messages);

    const result = await chatCompletion(settings, composed);
    settingsAccess.onAssistantMessage?.();
    return result.message;
  });

  ipcMain.handle(
    IPC_CHANNELS.testConnection,
    async (_event, payload: EndpointSettings) => {
      const settings = normalizeSettings(payload);
      return testConnection(settings);
    }
  );
}
