import type { CopilotSession as CopilotSessionType } from '@github/copilot-sdk';
import { getClient } from './client';
import { getSdk } from './sdk';
import type { SessionState } from './types';

// Persistent session — reused across messages for speed.
// Recreated when model/system prompt changes or when explicitly reset.
export let activeSession: SessionState | null = null;

function isSessionStale(model: string, systemPrompt: string, forceNew: boolean): boolean {
  if (!activeSession) return true;
  const settingsChanged =
    activeSession.model !== model || activeSession.systemPrompt !== systemPrompt;
  return settingsChanged || (forceNew && activeSession.messageCount > 0);
}

async function createNewSession(
  model: string,
  systemPrompt: string
): Promise<CopilotSessionType> {
  const { approveAll } = await getSdk();
  const client = await getClient();
  return client.createSession({
    model: model || 'gpt-4o',
    streaming: true,
    systemMessage: systemPrompt ? { mode: 'replace', content: systemPrompt } : undefined,
    availableTools: [],
    infiniteSessions: { enabled: false },
    onPermissionRequest: approveAll
  });
}

export async function destroyActiveSession(): Promise<void> {
  if (activeSession) {
    await activeSession.session.disconnect().catch(() => {});
    activeSession = null;
  }
}

export async function getOrCreateSession(
  model: string,
  systemPrompt: string,
  forceNew: boolean
): Promise<CopilotSessionType> {
  if (isSessionStale(model, systemPrompt, forceNew)) await destroyActiveSession();
  if (!activeSession) {
    const session = await createNewSession(model, systemPrompt);
    activeSession = { session, model, systemPrompt, messageCount: 0 };
  }
  return activeSession.session;
}

/** Invalidates the active session if it matches the given session instance. */
export async function invalidateSession(session: CopilotSessionType): Promise<void> {
  if (activeSession?.session === session) {
    await session.disconnect().catch(() => {});
    activeSession = null;
  }
}

export function incrementMessageCount(): void {
  if (activeSession) activeSession.messageCount++;
}
