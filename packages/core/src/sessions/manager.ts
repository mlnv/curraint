import { deleteSessionFile, listSessionFiles, readSession, writeSession } from './storage';
import type { SavedSession, SessionSummary } from './types';

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
  return readSession(id);
}

export function saveSession(session: SavedSession): void {
  writeSession(session);
}

export function deleteSession(id: string): void {
  deleteSessionFile(id);
}
