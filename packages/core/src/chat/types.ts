import type { ChatMessage } from '../types';

export type ChatSessionState = {
  conversation: ChatMessage[];
  status: string;
  isSending: boolean;
  isStopping: boolean;
};

export type ChatSessionTransport = {
  streamChat: (
    messages: ChatMessage[],
    onDelta: (delta: string) => void,
    options?: { signal?: AbortSignal }
  ) => Promise<string>;
  cancelChatStream?: () => Promise<void>;
  clearSession?: () => Promise<void>;
};

export type ChatSessionSubscriber = {
  onStateChange?: (state: ChatSessionState) => void;
  onDelta?: (delta: string) => void;
};

export type ChatSessionCore = {
  getState: () => ChatSessionState;
  subscribe: (subscriber: ChatSessionSubscriber) => () => void;
  submitPrompt: (content: string) => Promise<void>;
  editUserMessage: (index: number, editedContent: string) => Promise<void>;
  retryLastMessage: () => Promise<void>;
  stopResponse: () => Promise<void>;
  clearConversation: () => Promise<void>;
  loadConversation: (messages: ChatMessage[]) => void;
};
