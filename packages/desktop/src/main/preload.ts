import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type CurraintApi } from '../ipc';
import type { AppSettings } from '../types';
import type { SavedSession } from '@curraint/core';

let activeCancelableRequestId: string | null = null;

function toAbortError(reason: unknown): Error {
  if (reason instanceof Error) {
    return reason;
  }

  return new DOMException('The operation was aborted.', 'AbortError');
}

const api: CurraintApi = {
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.getSettings),
  getFeatureFlags: () => ipcRenderer.invoke(IPC_CHANNELS.getFeatureFlags),
  saveSettings: (settings) => ipcRenderer.invoke(IPC_CHANNELS.saveSettings, settings),
  chat: (messages) => ipcRenderer.invoke(IPC_CHANNELS.chatSend, messages),
  summarizeMessages: async (messages, options) => {
    if (options?.signal?.aborted) {
      throw toAbortError(options.signal.reason);
    }

    const requestId = crypto.randomUUID();
    activeCancelableRequestId = requestId;
    const onAbort = (): void => {
      void ipcRenderer.invoke(IPC_CHANNELS.chatCancel, requestId);
    };
    options?.signal?.addEventListener('abort', onAbort, { once: true });

    try {
      return await ipcRenderer.invoke(IPC_CHANNELS.chatSummarize, { requestId, messages });
    } finally {
      options?.signal?.removeEventListener('abort', onAbort);
      if (activeCancelableRequestId === requestId) {
        activeCancelableRequestId = null;
      }
    }
  },
  chatStream: async (messages, onDelta, options) => {
    const requestId = crypto.randomUUID();
    activeCancelableRequestId = requestId;
    const onChunk = (
      _event: Electron.IpcRendererEvent,
      payload: { requestId: string; delta: string }
    ): void => {
      if (payload.requestId !== requestId) {
        return;
      }

      onDelta(payload.delta);
    };

    ipcRenderer.on(IPC_CHANNELS.chatStreamChunk, onChunk);

    try {
      return await ipcRenderer.invoke(IPC_CHANNELS.chatStream, {
        requestId,
        messages,
        options: {
          compactedContext: options?.compactedContext ?? null
        }
      });
    } finally {
      ipcRenderer.removeListener(IPC_CHANNELS.chatStreamChunk, onChunk);
      if (activeCancelableRequestId === requestId) {
        activeCancelableRequestId = null;
      }
    }
  },
  cancelChatStream: async () => {
    if (!activeCancelableRequestId) {
      return;
    }

    await ipcRenderer.invoke(IPC_CHANNELS.chatCancel, activeCancelableRequestId);
  },
  clearChatSession: () => ipcRenderer.invoke(IPC_CHANNELS.chatClear),
  testConnection: (settings) =>
    ipcRenderer.invoke(IPC_CHANNELS.testConnection, settings),
  submitQuickInput: (message) =>
    ipcRenderer.invoke(IPC_CHANNELS.quickInputSubmit, message),
  closeQuickInput: () =>
    ipcRenderer.invoke(IPC_CHANNELS.quickInputClose),
  hideChatWindow: () =>
    ipcRenderer.invoke(IPC_CHANNELS.chatWindowHide),
  openLogFolder: () =>
    ipcRenderer.invoke(IPC_CHANNELS.openLogFolder),
  openExternal: (url: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.openExternal, url),
  onReceiveQuickInput: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, message: string): void => {
      callback(message);
    };
    ipcRenderer.on(IPC_CHANNELS.receiveQuickInput, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.receiveQuickInput, handler);
  },
  onShortcutRegistered: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, ok: boolean): void => {
      callback(ok);
    };
    ipcRenderer.on(IPC_CHANNELS.shortcutRegistered, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.shortcutRegistered, handler);
  },
  onSettingsChanged: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, settings: AppSettings): void => {
      callback(settings);
    };
    ipcRenderer.on(IPC_CHANNELS.settingsChanged, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.settingsChanged, handler);
  },
  listSessions: () => ipcRenderer.invoke(IPC_CHANNELS.sessionsList),
  getSession: (id) => ipcRenderer.invoke(IPC_CHANNELS.sessionsGet, id),
  saveSession: (session) => ipcRenderer.invoke(IPC_CHANNELS.sessionsSave, session),
  deleteSession: (id) => ipcRenderer.invoke(IPC_CHANNELS.sessionsDelete, id),
  openSessionsWindow: () => ipcRenderer.invoke(IPC_CHANNELS.sessionsOpen),
  loadSession: (id) => ipcRenderer.invoke(IPC_CHANNELS.sessionsLoad, id),
  openLicensesWindow: () => ipcRenderer.invoke(IPC_CHANNELS.openLicensesWindow),
  onSessionLoad: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, session: SavedSession): void => {
      callback(session);
    };
    ipcRenderer.on(IPC_CHANNELS.sessionsLoadPush, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.sessionsLoadPush, handler);
  }
};

contextBridge.exposeInMainWorld('curraint', api);

declare global {
  interface Window {
    curraint: CurraintApi;
  }
}
