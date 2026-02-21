import type { ChatMessage, EndpointSettings } from './types';

export const IPC_CHANNELS = {
  getSettings: 'settings:get',
  saveSettings: 'settings:save',
  chatSend: 'chat:send',
  testConnection: 'settings:testConnection'
} as const;

export type FlowAiApi = {
  getSettings: () => Promise<EndpointSettings>;
  saveSettings: (settings: EndpointSettings) => Promise<EndpointSettings>;
  chat: (messages: ChatMessage[]) => Promise<string>;
  testConnection: (settings: EndpointSettings) => Promise<string>;
};
