import type { ChatMessage } from '@curraint/core';
import type { AppSettings } from './types';

export const IPC_CHANNELS = {
  getSettings: 'settings:get',
  saveSettings: 'settings:save',
  settingsChanged: 'settings:changed',
  chatSend: 'chat:send',
  chatStream: 'chat:stream',
  chatStreamChunk: 'chat:stream:chunk',
  chatCancel: 'chat:cancel',
  chatClear: 'chat:clear',
  testConnection: 'settings:testConnection',
  quickInputSubmit: 'quick-input:submit',
  quickInputClose: 'quick-input:close',
  receiveQuickInput: 'quick-input:receive',
  shortcutRegistered: 'shortcut:registered',
  chatWindowHide: 'chat-window:hide'
} as const;

export type ChatStreamPayload = {
  requestId: string;
  messages: ChatMessage[];
};

export type ChatStreamChunkPayload = {
  requestId: string;
  delta: string;
};

export type CurraintApi = {
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<AppSettings>;
  chat: (messages: ChatMessage[]) => Promise<string>;
  chatStream: (
    messages: ChatMessage[],
    onDelta: (delta: string) => void
  ) => Promise<string>;
  cancelChatStream: () => Promise<void>;
  clearChatSession: () => Promise<void>;
  testConnection: (settings: AppSettings) => Promise<string>;
  submitQuickInput: (message: string) => Promise<void>;
  closeQuickInput: () => Promise<void>;
  hideChatWindow: () => Promise<void>;
  onReceiveQuickInput: (callback: (message: string) => void) => () => void;
  onShortcutRegistered: (callback: (ok: boolean) => void) => () => void;
  onSettingsChanged: (callback: (settings: AppSettings) => void) => () => void;
};
