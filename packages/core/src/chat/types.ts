import type { CompactedContext, ContextSafetyLimits } from '../context';
import type { ChatMessage, TokenUsage } from '../types';

export type ChatSessionState = {
  conversation: ChatMessage[];
  status: string;
  isSending: boolean;
  isStopping: boolean;
  isCompactingContext: boolean;
  compactedContext: CompactedContext | null;
};

export type ChatStreamResult = {
  text: string;
  usage?: TokenUsage;
};

export type ChatSessionTransport = {
  streamChat: (
    messages: ChatMessage[],
    onDelta: (delta: string) => void,
    options?: { signal?: AbortSignal; compactedContext?: CompactedContext | null }
  ) => Promise<ChatStreamResult>;
  summarizeMessages: (
    messages: ChatMessage[],
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
  compactContext: (limits: ContextSafetyLimits) => Promise<boolean>;
  clearConversation: () => Promise<void>;
  loadConversation: (messages: ChatMessage[], compactedContext?: CompactedContext | null) => void;
};
