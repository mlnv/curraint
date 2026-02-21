import type { ChatMessage, EndpointSettings } from './types';

export const IPC_CHANNELS = {
  getSettings: 'settings:get',
  saveSettings: 'settings:save',
  chatSend: 'chat:send',
  chatStream: 'chat:stream',
  chatStreamChunk: 'chat:stream:chunk',
  chatCancel: 'chat:cancel',
  testConnection: 'settings:testConnection'
} as const;

export type ChatStreamPayload = {
  requestId: string;
  messages: ChatMessage[];
};

export type ChatStreamChunkPayload = {
  requestId: string;
  delta: string;
};

export type FlowAiApi = {
  getSettings: () => Promise<EndpointSettings>;
  saveSettings: (settings: EndpointSettings) => Promise<EndpointSettings>;
  chat: (messages: ChatMessage[]) => Promise<string>;
  chatStream: (
    messages: ChatMessage[],
    onDelta: (delta: string) => void
  ) => Promise<string>;
  cancelChatStream: () => Promise<void>;
  testConnection: (settings: EndpointSettings) => Promise<string>;
};
