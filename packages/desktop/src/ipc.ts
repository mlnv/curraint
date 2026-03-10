import type { ChatMessage } from '@curraint/core';
import type { AppSettings } from './types';
import type { SavedSession, SessionSummary } from '@curraint/core';

export const IPC_CHANNELS = {
  getSettings: 'settings:get',
  openExternal: 'shell:openExternal',
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
  chatWindowHide: 'chat-window:hide',
  openLogFolder: 'log:openFolder',
  sessionsList: 'sessions:list',
  sessionsGet: 'sessions:get',
  sessionsSave: 'sessions:save',
  sessionsDelete: 'sessions:delete',
  sessionsLoad: 'sessions:load',
  sessionsLoadPush: 'sessions:load:push',
  sessionsOpen: 'sessions:open'
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
  openExternal: (url: string) => Promise<void>;
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
  openLogFolder: () => Promise<void>;
  onReceiveQuickInput: (callback: (message: string) => void) => () => void;
  onShortcutRegistered: (callback: (ok: boolean) => void) => () => void;
  onSettingsChanged: (callback: (settings: AppSettings) => void) => () => void;
  listSessions: () => Promise<SessionSummary[]>;
  getSession: (id: string) => Promise<SavedSession | null>;
  saveSession: (session: SavedSession) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  openSessionsWindow: () => Promise<void>;
  loadSession: (id: string) => Promise<void>;
  onSessionLoad: (callback: (session: SavedSession) => void) => () => void;
};
