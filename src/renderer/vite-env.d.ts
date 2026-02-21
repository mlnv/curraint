/// <reference types="vite/client" />

import type { ChatMessage, EndpointSettings } from '../common/types';

type FlowAiApi = {
  getSettings: () => Promise<EndpointSettings>;
  saveSettings: (settings: EndpointSettings) => Promise<EndpointSettings>;
  chat: (messages: ChatMessage[]) => Promise<string>;
};

declare global {
  interface Window {
    flowai: FlowAiApi;
  }
}

export {};
