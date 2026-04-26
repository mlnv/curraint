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

/**
 * Represents older transcript content that has been replaced by a summary.
 *
 * `sourceMessageCount` is a slice boundary used by `composeConversation` as
 * `messages.slice(compactedContext.sourceMessageCount)`. Callers must update it
 * whenever earlier messages are inserted, removed, or reordered.
 *
 * `sourceCharacterCount` is the approximate character cost of the original
 * source slice. It is used for telemetry, UI, and re-summarization heuristics.
 */
export type CompactedContext = {
  summary: string;
  sourceMessageCount: number;
  sourceCharacterCount: number;
};

export const CONTEXT_SAFETY_LIMIT_BOUNDS = {
  minMessages: 4,
  maxMessages: 1_200,
  minCharacters: 4_000,
  maxCharacters: 2_000_000,
  summarySourceMessages: 8,
  summarySnippetChars: 180
} as const;
