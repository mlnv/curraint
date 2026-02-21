import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type FlowAiApi } from '../common/ipc';

const api: FlowAiApi = {
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.getSettings),
  saveSettings: (settings) => ipcRenderer.invoke(IPC_CHANNELS.saveSettings, settings),
  chat: (messages) => ipcRenderer.invoke(IPC_CHANNELS.chatSend, messages)
};

contextBridge.exposeInMainWorld('flowai', api);

declare global {
  interface Window {
    flowai: FlowAiApi;
  }
}
