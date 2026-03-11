import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync
} from 'node:fs';
import { join } from 'node:path';
import { userDataDir } from '../settings/paths';
import type { SavedSession } from './types';

export function sessionsDir(): string {
  return join(userDataDir(), 'sessions');
}

function sessionFilePath(id: string): string {
  return join(sessionsDir(), `${id}.json`);
}

function ensureSessionsDir(): void {
  const dir = sessionsDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function listSessionFiles(): string[] {
  const dir = sessionsDir();
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -5));
  } catch {
    return [];
  }
}

export function readSession(id: string): SavedSession | null {
  const filePath = sessionFilePath(id);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as SavedSession;
  } catch {
    console.warn(`[sessions] Failed to parse session file (corrupt?): ${filePath}`);
    return null;
  }
}

export function writeSession(session: SavedSession): void {
  ensureSessionsDir();
  writeFileSync(sessionFilePath(session.id), JSON.stringify(session, null, 2), 'utf8');
}

export function deleteSessionFile(id: string): void {
  const filePath = sessionFilePath(id);
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
}
