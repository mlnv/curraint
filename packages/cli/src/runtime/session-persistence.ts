import { persistConversation } from '@curraint/core';
import type { ChatMessage } from '@curraint/core';

export type SessionPersistenceState = {
  currentSessionId: string | null;
  currentSessionCreatedAt: number;
};

type PersistSessionOptions = SessionPersistenceState & {
  enableSessionSaving: boolean;
  conversation: ChatMessage[];
  now?: () => number;
};

export function persistSessionIfEnabled(
  options: PersistSessionOptions,
): SessionPersistenceState {
  const { enableSessionSaving } = options;

  if (!enableSessionSaving) {
    return {
      currentSessionId: options.currentSessionId,
      currentSessionCreatedAt: options.currentSessionCreatedAt,
    };
  }

  return persistConversation({
    conversation: options.conversation,
    currentSessionId: options.currentSessionId,
    currentSessionCreatedAt: options.currentSessionCreatedAt,
    now: options.now,
  });
}