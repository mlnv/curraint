import { ipcMain } from 'electron';
import { IPC_CHANNELS, type ChatStreamChunkPayload, type ChatStreamPayload } from '../common/ipc';
import {
  chatCompletion,
  chatCompletionStream,
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

function isChatStreamPayload(payload: unknown): payload is ChatStreamPayload {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }

  const candidate = payload as { requestId?: unknown; messages?: unknown };
  return typeof candidate.requestId === 'string' && isChatMessageArray(candidate.messages);
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

  ipcMain.handle(IPC_CHANNELS.chatStream, async (event, payload: unknown) => {
    if (!isChatStreamPayload(payload)) {
      throw new Error('Invalid chat stream payload.');
    }

    const settings = settingsAccess.getSettings();
    const composed = composeConversation(settings, payload.messages);
    let hasStreamedChunk = false;

    try {
      const result = await chatCompletionStream(settings, composed, {
        onDelta: (delta) => {
          hasStreamedChunk = true;
          const chunkPayload: ChatStreamChunkPayload = {
            requestId: payload.requestId,
            delta
          };
          event.sender.send(IPC_CHANNELS.chatStreamChunk, chunkPayload);
        }
      });

      settingsAccess.onAssistantMessage?.();
      return result.message;
    } catch (error) {
      if (hasStreamedChunk) {
        throw error;
      }

      const fallback = await chatCompletion(settings, composed);
      settingsAccess.onAssistantMessage?.();
      return fallback.message;
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.testConnection,
    async (_event, payload: EndpointSettings) => {
      const settings = normalizeSettings(payload);
      return testConnection(settings);
    }
  );
}
