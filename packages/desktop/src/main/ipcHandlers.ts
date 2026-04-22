import { ipcMain, shell, app } from 'electron';
import { IPC_CHANNELS, type ChatStreamChunkPayload, type ChatStreamPayload } from '../ipc';
import { debugLog, setDebugEnabled } from '@curraint/core';
import {
  chatCompletion,
  chatCompletionStream,
  testConnection
} from '@curraint/core';
import { copilotChatStream, copilotTestConnection, resetCopilotSession } from '@curraint/core';
import { composeConversation } from '@curraint/core';
import { listSessions, getSession, saveSession, deleteSession } from '@curraint/core';
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

  const candidate = payload as {
    requestId?: unknown;
    messages?: unknown;
    compactedContext?: unknown;
  };
  const compactedContext = candidate.compactedContext;
  const hasValidCompactedContext =
    compactedContext === undefined ||
    compactedContext === null ||
    (
      typeof compactedContext === 'object' &&
      compactedContext !== null &&
      typeof (compactedContext as { summary?: unknown }).summary === 'string' &&
      typeof (compactedContext as { sourceMessageCount?: unknown }).sourceMessageCount === 'number' &&
      typeof (compactedContext as { sourceCharacterCount?: unknown }).sourceCharacterCount === 'number'
    );

  return (
    typeof candidate.requestId === 'string' &&
    isChatMessageArray(candidate.messages) &&
    hasValidCompactedContext
  );
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

    if (settings.provider === 'copilot') {
      const result = await copilotChatStream(
        settings.model,
        composed,
        { onDelta: () => {} }
      );
      settingsAccess.onAssistantMessage?.();
      return result.message;
    }

    const result = await chatCompletion(settings, composed);
    settingsAccess.onAssistantMessage?.();
    return result.message;
  });

  ipcMain.handle(IPC_CHANNELS.chatStream, async (event, payload: unknown) => {
    if (!isChatStreamPayload(payload)) {
      throw new Error('Invalid chat stream payload.');
    }

    const settings = settingsAccess.getSettings();
    const composed = composeConversation(settings, payload.messages, payload.compactedContext ?? null);
    let hasStreamedChunk = false;
    let streamedMessage = '';
    const controller = new AbortController();
    activeStreamControllers.set(payload.requestId, controller);

    // --- performance timing ---
    const _perfT0 = performance.now();
    let _perfFirstChunk = false;
    debugLog('PERF:main', 'chatStream IPC handler invoked', { provider: settings.provider });

    if (settings.provider === 'copilot') {
      try {
        const result = await copilotChatStream(
          settings.model,
          composed,
          {
            onDelta: (delta) => {
              if (!_perfFirstChunk) {
                _perfFirstChunk = true;
                debugLog('PERF:main', `first chunk sent to renderer +${(performance.now() - _perfT0).toFixed(0)}ms since IPC handler start`);
              }
              hasStreamedChunk = true;
              streamedMessage += delta;
              const chunkPayload: ChatStreamChunkPayload = {
                requestId: payload.requestId,
                delta
              };
              try {
                event.sender.send(IPC_CHANNELS.chatStreamChunk, chunkPayload);
              } catch {
                // renderer window closed mid-stream
              }
            }
          },
          { signal: controller.signal }
        );
        debugLog('PERF:main', `copilotChatStream resolved +${(performance.now() - _perfT0).toFixed(0)}ms total`);
        settingsAccess.onAssistantMessage?.();
        return { text: result.message, usage: result.usage };
      } catch (error) {
        if (isAbortError(error)) {
          return { text: streamedMessage };
        }
        throw error;
      } finally {
        activeStreamControllers.delete(payload.requestId);
      }
    }

    try {
      const result = await chatCompletionStream(settings, composed, {
        onDelta: (delta) => {
          if (!_perfFirstChunk) {
            _perfFirstChunk = true;
            debugLog('PERF:main', `first chunk sent to renderer +${(performance.now() - _perfT0).toFixed(0)}ms since IPC handler start`);
          }
          hasStreamedChunk = true;
          streamedMessage += delta;
          const chunkPayload: ChatStreamChunkPayload = {
            requestId: payload.requestId,
            delta
          };
          try {
            event.sender.send(IPC_CHANNELS.chatStreamChunk, chunkPayload);
          } catch {
            // renderer window closed mid-stream
          }
        }
      }, {
        signal: controller.signal
      });

      debugLog('PERF:main', `chatCompletionStream resolved +${(performance.now() - _perfT0).toFixed(0)}ms total`);
      settingsAccess.onAssistantMessage?.();
      return { text: result.message, usage: result.usage };
    } catch (error) {
      if (isAbortError(error)) {
        return { text: streamedMessage };
      }

      if (hasStreamedChunk) {
        throw error;
      }

      const fallback = await chatCompletion(settings, composed);
      settingsAccess.onAssistantMessage?.();
      return { text: fallback.message, usage: fallback.usage };
    } finally {
      activeStreamControllers.delete(payload.requestId);
    }
  });

  ipcMain.handle(IPC_CHANNELS.chatClear, async () => {
    const settings = settingsAccess.getSettings();
    if (settings.provider === 'copilot') {
      await resetCopilotSession(settings.model, settings.systemPrompt);
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
      if (settings.provider === 'copilot') {
        return copilotTestConnection(settings.model);
      }
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
