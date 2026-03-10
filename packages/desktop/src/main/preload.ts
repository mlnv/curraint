import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type CurraintApi } from '../ipc';
import type { AppSettings } from '../types';
import type { SavedSession } from '@curraint/core';

let activeStreamRequestId: string | null = null;

const api: CurraintApi = {
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.getSettings),
  saveSettings: (settings) => ipcRenderer.invoke(IPC_CHANNELS.saveSettings, settings),
  chat: (messages) => ipcRenderer.invoke(IPC_CHANNELS.chatSend, messages),
  chatStream: async (messages, onDelta) => {
    const requestId = crypto.randomUUID();
    activeStreamRequestId = requestId;
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
        messages
      });
    } finally {
      ipcRenderer.removeListener(IPC_CHANNELS.chatStreamChunk, onChunk);
      if (activeStreamRequestId === requestId) {
        activeStreamRequestId = null;
      }
    }
  },
  cancelChatStream: async () => {
    if (!activeStreamRequestId) {
      return;
    }

    await ipcRenderer.invoke(IPC_CHANNELS.chatCancel, activeStreamRequestId);
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
