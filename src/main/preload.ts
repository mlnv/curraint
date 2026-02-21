import { contextBridge, ipcRenderer } from 'electron';
import type { ChatMessage, EndpointSettings } from '../common/types';

type Api = {
  getSettings: () => Promise<EndpointSettings>;
  saveSettings: (settings: EndpointSettings) => Promise<EndpointSettings>;
  chat: (messages: ChatMessage[]) => Promise<string>;
};

const api: Api = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  chat: (messages) => ipcRenderer.invoke('chat:send', messages)
};

contextBridge.exposeInMainWorld('flowai', api);

declare global {
  interface Window {
    flowai: Api;
  }
}
