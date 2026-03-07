import { getClient, stopClient } from './client';
import { getSdk } from './sdk';
import { destroyActiveSession, getOrCreateSession } from './session';

/** Pre-warm: eagerly start the CLI and create the session to reduce cold-start overhead. */
export async function warmupCopilotSession(
  model: string,
  systemPrompt: string
): Promise<void> {
  try {
    await getOrCreateSession(model, systemPrompt, false);
  } catch {
    // Ignore warmup failures — the real request will surface the error.
  }
}

/** Reset the active session and pre-warm a new one immediately. */
export async function resetCopilotSession(
  model: string,
  systemPrompt: string
): Promise<void> {
  await destroyActiveSession();
  await warmupCopilotSession(model, systemPrompt);
}

export async function copilotTestConnection(model: string): Promise<string> {
  const [client, { approveAll }] = await Promise.all([getClient(), getSdk()]);
  const session = await client.createSession({
    model: model || 'gpt-4o',
    infiniteSessions: { enabled: false },
    onPermissionRequest: approveAll
  });
  try {
    await session.sendAndWait({ prompt: 'Say "OK" and nothing else.' }, 15000);
    await session.destroy();
    return 'Connection successful. GitHub Copilot is ready.';
  } catch (error) {
    await session.destroy().catch(() => {});
    throw error;
  }
}

export async function stopCopilotClient(): Promise<void> {
  await destroyActiveSession();
  await stopClient();
}
