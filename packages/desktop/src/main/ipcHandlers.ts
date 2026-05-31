import { ipcMain, shell, app } from 'electron';
import { IPC_CHANNELS, type ChatStreamChunkPayload, type ChatStreamPayload } from '../ipc';
import { debugLog, setDebugEnabled } from '@curraint/core';
import {
  chatCompletion,
  testConnection
} from '@curraint/core';
import { composeConversation } from '@curraint/core';
import { listSessions, getSession, saveSession, deleteSession } from '@curraint/core';
import { buildPiTransport } from '@curraint/core';
import type { ChatMessage, SavedSession } from '@curraint/core';
import { normalizeAppSettings } from '../appSettings';
import type { AppSettings } from '../types';

type SettingsAccess = {
  getSettings: () => AppSettings;
  saveSettings: (next: AppSettings) => AppSettings;
  onAssistantMessage?: () => void;
  sendToChat?: (channel: string, data: unknown) => void;
  showChatWindow?: () => void;
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

function isValidSavedSession(payload: unknown): payload is SavedSession {
  if (typeof payload !== 'object' || payload === null) return false;
  const s = payload as Record<string, unknown>;
  return (
    typeof s['id'] === 'string' &&
    typeof s['title'] === 'string' &&
    typeof s['createdAt'] === 'number' &&
    typeof s['updatedAt'] === 'number' &&
    Array.isArray(s['messages'])
  );
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

export function registerIpcHandlers(settingsAccess: SettingsAccess): void {
  const activeStreamControllers = new Map<string, AbortController>();

  // Apply the persisted debug-logging preference on startup.
  setDebugEnabled(settingsAccess.getSettings().enableDebugLogging);

  ipcMain.handle(IPC_CHANNELS.getSettings, () => settingsAccess.getSettings());

  ipcMain.handle(IPC_CHANNELS.saveSettings, (_event, next: AppSettings) => {
    const saved = settingsAccess.saveSettings(next);
    setDebugEnabled(saved.enableDebugLogging);
    return saved;
  });

  ipcMain.handle(IPC_CHANNELS.openLogFolder, () => {
    return shell.openPath(app.getPath('logs'));
  });

  ipcMain.handle(IPC_CHANNELS.openExternal, (_event, url: string) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return;
    }
    if (parsed.protocol === 'https:') {
      void shell.openExternal(url);
    }
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
    const controller = new AbortController();
    activeStreamControllers.set(payload.requestId, controller);

    const piTransport = buildPiTransport(settings);

    try {
      const result = await piTransport.streamChat(
        payload.messages,
        (delta) => {
          const chunkPayload: ChatStreamChunkPayload = {
            requestId: payload.requestId,
            delta
          };
          try {
            event.sender.send(IPC_CHANNELS.chatStreamChunk, chunkPayload);
          } catch {
            // renderer window closed mid-stream
          }
        },
        { signal: controller.signal }
      );
      settingsAccess.onAssistantMessage?.();
      return { text: result.text, usage: result.usage };
    } catch (error) {
      if (isAbortError(error)) {
        return { text: '' };
      }
      throw error;
    } finally {
      activeStreamControllers.delete(payload.requestId);
    }
  });

  ipcMain.handle(IPC_CHANNELS.chatCancel, async (_event, requestId: unknown) => {
    if (typeof requestId !== 'string') {
      return;
    }

    const controller = activeStreamControllers.get(requestId);
    if (!controller) {
      return;
    }

    controller.abort();
    activeStreamControllers.delete(requestId);
  });

  ipcMain.handle(
    IPC_CHANNELS.testConnection,
    async (_event, payload: AppSettings) => {
      const settings = normalizeAppSettings(payload);
      return testConnection(settings);
    }
  );

  ipcMain.handle(IPC_CHANNELS.sessionsList, () => listSessions());

  ipcMain.handle(IPC_CHANNELS.sessionsGet, (_event, id: unknown) => {
    if (typeof id !== 'string') return null;
    return getSession(id);
  });

  ipcMain.handle(IPC_CHANNELS.sessionsSave, (_event, session: unknown) => {
    if (!isValidSavedSession(session)) return;
    saveSession(session);
  });

  ipcMain.handle(IPC_CHANNELS.sessionsDelete, (_event, id: unknown) => {
    if (typeof id !== 'string') return;
    deleteSession(id);
  });

  ipcMain.handle(IPC_CHANNELS.sessionsLoad, (_event, id: unknown) => {
    if (typeof id !== 'string') return;
    const session = getSession(id);
    if (session) {
      settingsAccess.sendToChat?.(IPC_CHANNELS.sessionsLoadPush, session);
      settingsAccess.showChatWindow?.();
    }
  });
}
