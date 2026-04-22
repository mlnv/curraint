import { deriveTitle, generateSessionId, saveSession } from '@curraint/core';
import type { CompactedContext } from '@curraint/core';
import type { ChatMessage } from '@curraint/core';

export type SessionPersistenceState = {
  currentSessionId: string | null;
  currentSessionCreatedAt: number;
};

type PersistSessionOptions = SessionPersistenceState & {
  enableSessionSaving: boolean;
  conversation: ChatMessage[];
  compactedContext?: CompactedContext | null;
  now?: () => number;
};

export function persistSessionIfEnabled(
  options: PersistSessionOptions,
): SessionPersistenceState {
  const {
    enableSessionSaving,
    conversation,
    now = Date.now,
  } = options;

  if (!enableSessionSaving) {
    return {
      currentSessionId: options.currentSessionId,
      currentSessionCreatedAt: options.currentSessionCreatedAt,
    };
  }

  const messages = conversation.filter((message) => message.role !== 'system');
  if (messages.length === 0) {
    return {
      currentSessionId: options.currentSessionId,
      currentSessionCreatedAt: options.currentSessionCreatedAt,
    };
  }

  const timestamp = now();
  const currentSessionId = options.currentSessionId ?? generateSessionId();
  const currentSessionCreatedAt = options.currentSessionId
    ? options.currentSessionCreatedAt
    : timestamp;
  const firstUserMessage = messages.find((message) => message.role === 'user')?.content ?? '';

  saveSession({
    id: currentSessionId,
    title: deriveTitle(firstUserMessage),
    createdAt: currentSessionCreatedAt,
    updatedAt: timestamp,
    messages,
    compactedContext: options.compactedContext ?? null,
  });

  return {
    currentSessionId,
    currentSessionCreatedAt,
  };
}