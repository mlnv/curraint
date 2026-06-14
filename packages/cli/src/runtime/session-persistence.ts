import { persistConversation } from '@curraint/core';
import type { ChatMessage, ProviderId } from '@curraint/core';

export type SessionPersistenceState = {
  currentSessionId: string | null;
  currentSessionCreatedAt: number;
};

type PersistSessionOptions = SessionPersistenceState & {
  enableSessionSaving: boolean;
  conversation: ChatMessage[];
  provider: ProviderId;
  model: string;
  profileId?: string;
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
    provider: options.provider,
    model: options.model,
    profileId: options.profileId,
    now: options.now,
  });
}