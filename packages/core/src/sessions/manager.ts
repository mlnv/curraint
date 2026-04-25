import { deleteSessionFile, listSessionFiles, readSession, writeSession } from './storage';
import type { CompactedContext } from '../context';
import type { ChatMessage } from '../types';
import {
  COMPACTED_CONTEXT_SCHEMA_VERSION,
  type SavedSession,
  type SessionSummary,
} from './types';

export type PersistConversationOptions = {
  conversation: ChatMessage[];
  compactedContext?: CompactedContext | null;
  currentSessionId: string | null;
  currentSessionCreatedAt: number;
  now?: () => number;
};

export type PersistConversationResult = {
  currentSessionId: string | null;
  currentSessionCreatedAt: number;
};

export function generateSessionId(): string {
  const rand = Math.floor(Math.random() * 0xffff)
    .toString(16)
    .padStart(4, '0');
  return `${Date.now()}-${rand}`;
}

export function deriveTitle(firstUserMessage: string): string {
  const trimmed = firstUserMessage.trim();
  return trimmed.length > 60 ? trimmed.slice(0, 60) : trimmed;
}

export function listSessions(): SessionSummary[] {
  const ids = listSessionFiles();
  const summaries: SessionSummary[] = [];

  for (const id of ids) {
    const session = readSession(id);
    if (!session) continue;
    summaries.push({
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messageCount: session.messages.length
    });
  }

  return summaries.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getSession(id: string): SavedSession | null {
  const session = readSession(id);
  return session ? normalizeSessionFromStorage(session) : null;
}

export function saveSession(session: SavedSession): void {
  writeSession(normalizeSessionForStorage(session));
}

function normalizeLegacyCompactedContext(
  messages: ChatMessage[],
  compactedContext: CompactedContext,
): CompactedContext {
  let remainingNonEmptyMessages = Math.max(0, compactedContext.sourceMessageCount);
  let rawBoundaryIndex = 0;

  while (rawBoundaryIndex < messages.length && remainingNonEmptyMessages > 0) {
    if (messages[rawBoundaryIndex]!.content.trim().length > 0) {
      remainingNonEmptyMessages -= 1;
    }
    rawBoundaryIndex += 1;
  }

  return {
    ...compactedContext,
    sourceMessageCount: rawBoundaryIndex,
  };
}

function normalizeSessionForStorage(session: SavedSession): SavedSession {
  const compactedContext = session.compactedContext ?? undefined;
  if (!compactedContext) {
    return {
      ...session,
      compactedContext: undefined,
      compactedContextSchemaVersion: undefined,
    };
  }

  return {
    ...session,
    compactedContext,
    compactedContextSchemaVersion: COMPACTED_CONTEXT_SCHEMA_VERSION,
  };
}

function normalizeSessionFromStorage(session: SavedSession): SavedSession {
  const compactedContext = session.compactedContext ?? undefined;
  if (!compactedContext) {
    return {
      ...session,
      compactedContext: undefined,
      compactedContextSchemaVersion: undefined,
    };
  }

  const normalizedCompactedContext =
    session.compactedContextSchemaVersion === COMPACTED_CONTEXT_SCHEMA_VERSION
      ? {
          ...compactedContext,
          sourceMessageCount: Math.min(
            Math.max(compactedContext.sourceMessageCount, 0),
            session.messages.length,
          ),
        }
      : normalizeLegacyCompactedContext(session.messages, compactedContext);

  return {
    ...session,
    compactedContext: normalizedCompactedContext,
    compactedContextSchemaVersion: COMPACTED_CONTEXT_SCHEMA_VERSION,
  };
}

export function persistConversation(
  options: PersistConversationOptions,
): PersistConversationResult {
  const { conversation, now = Date.now } = options;
  const messages = conversation.filter((message) => message.role !== 'system');

  if (messages.length === 0) {
    return {
      currentSessionId: options.currentSessionId,
      currentSessionCreatedAt: options.currentSessionCreatedAt
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
    compactedContext: options.compactedContext ?? undefined,
    messages,
  });

  return {
    currentSessionId,
    currentSessionCreatedAt,
  };
}

export function deleteSession(id: string): void {
  deleteSessionFile(id);
}
