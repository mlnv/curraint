import type { ChatMessage } from '../types';

export type { ChatMessage };

export type ContextSafetyLimits = {
  maxMessages: number;
  maxCharacters: number;
};

export type TruncatedConversation = {
  keptMessages: ChatMessage[];
  summary: string | null;
};

export type CompactedContext = {
  summary: string;
  sourceMessageCount: number;
  sourceCharacterCount: number;
};

export const CONTEXT_SAFETY_LIMIT_BOUNDS = {
  minMessages: 4,
  maxMessages: 120,
  minCharacters: 4_000,
  maxCharacters: 200_000,
  summarySourceMessages: 8,
  summarySnippetChars: 180
} as const;
