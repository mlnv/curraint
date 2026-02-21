import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type FlowAiApi } from '../common/ipc';

const api: FlowAiApi = {
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.getSettings),
  saveSettings: (settings) => ipcRenderer.invoke(IPC_CHANNELS.saveSettings, settings),
  chat: (messages) => ipcRenderer.invoke(IPC_CHANNELS.chatSend, messages),
  chatStream: async (messages, onDelta) => {
    const requestId = crypto.randomUUID();
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
    }
  },
  testConnection: (settings) =>
    ipcRenderer.invoke(IPC_CHANNELS.testConnection, settings)
};

contextBridge.exposeInMainWorld('flowai', api);

declare global {
  interface Window {
    flowai: FlowAiApi;
  }
}
