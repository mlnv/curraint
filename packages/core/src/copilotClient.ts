// Import types only — erased at compile time, safe in CJS builds.
import type {
  CopilotClient as CopilotClientType,
  CopilotSession as CopilotSessionType,
  approveAll as approveAllType
} from '@github/copilot-sdk';
import type { ChatMessage } from './types';
import { debugLog } from './debugLog';

type Sdk = { CopilotClient: typeof CopilotClientType; approveAll: typeof approveAllType };

// The SDK is ESM-only, so we must load it via dynamic import() at runtime.
// Wrapping in Function() prevents tsup/esbuild from rewriting it to require().
async function loadSdk(): Promise<Sdk> {
  return (Function('return import("@github/copilot-sdk")')() as Promise<Sdk>);
}

let sdkCache: Sdk | null = null;
async function getSdk(): Promise<Sdk> {
  if (!sdkCache) sdkCache = await loadSdk();
  return sdkCache;
}

// Singleton CopilotClient — spawns the CLI subprocess once and reuses it.
let clientInstance: CopilotClientType | null = null;

async function getClient(): Promise<CopilotClientType> {
  if (!clientInstance) {
    const { CopilotClient } = await getSdk();

    // Strip env vars that interfere with the @github/copilot child process.
    // The CLI is itself an Electron binary; inheriting these can cause it to
    // attach to the parent's crash reporter or debugger and then exit cleanly.
    const stripKeys = [
      'NODE_OPTIONS',
      'VSCODE_INSPECTOR_OPTIONS',
      'ELECTRON_RUN_AS_NODE',
      'CHROME_CRASHPAD_PIPE_NAME',
      'ELECTRON_NO_ATTACH_CONSOLE',
      'ELECTRON_ENABLE_STACK_DUMPING',
    ];
    for (const key of stripKeys) {
      delete process.env[key];
    }

    // Use TCP instead of stdio so Electron's pipe interception doesn't break
    // the JSON-RPC channel between this process and the CLI subprocess.
    clientInstance = new CopilotClient({
      useLoggedInUser: true,
      autoRestart: true,
      useStdio: false,
    });
  }
  return clientInstance;
}

// Persistent session — reused across messages for speed and natural history.
// Recreated when model or system prompt changes, or when explicitly reset.
type SessionState = {
  session: CopilotSessionType;
  model: string;
  systemPrompt: string;
  // Number of user messages sent to this session. Used to distinguish a fresh
  // (warmup) session from one that already has conversation history.
  messageCount: number;
};

let activeSession: SessionState | null = null;

async function getOrCreateSession(
  model: string,
  systemPrompt: string,
  forceNew: boolean
): Promise<CopilotSessionType> {
  const { approveAll } = await getSdk();
  const client = await getClient();

  const settingsChanged =
    activeSession &&
    (activeSession.model !== model || activeSession.systemPrompt !== systemPrompt);

  // Only destroy and recreate if settings changed or explicitly forced.
  // A forceNew with messageCount === 0 means the session is still fresh (from
  // warmup) — reuse it rather than paying the creation cost again.
  const needsNew = settingsChanged || (forceNew && activeSession && activeSession.messageCount > 0);

  if (needsNew && activeSession) {
    await activeSession.session.destroy().catch(() => {});
    activeSession = null;
  }

  if (!activeSession) {
    const session = await client.createSession({
      model: model || 'gpt-4o',
      streaming: true,
      systemMessage: systemPrompt
        ? { mode: 'replace', content: systemPrompt }
        : undefined,
      // Disable all built-in agentic tools so the model answers immediately
      // without spending time reasoning about which tools to invoke.
      availableTools: [],
      infiniteSessions: { enabled: false },
      onPermissionRequest: approveAll,
    });
    activeSession = { session, model, systemPrompt, messageCount: 0 };
  }

  return activeSession.session;
}

export type CopilotStreamCallbacks = {
  onDelta: (delta: string) => void;
};

export type CopilotStreamOptions = {
  signal?: AbortSignal;
};

export async function copilotChatStream(
  model: string,
  messages: ChatMessage[],
  callbacks: CopilotStreamCallbacks,
  options: CopilotStreamOptions = {}
): Promise<string> {
  const userMessages = messages.filter((m) => m.role === 'user');
  const lastUserMessage = userMessages[userMessages.length - 1];

  if (!lastUserMessage) {
    throw new Error('No user message found in conversation.');
  }

  // Extract system prompt (first system message content, if any).
  const systemPrompt = messages.find((m) => m.role === 'system')?.content ?? '';

  // Detect a fresh conversation: only 1 user message and no assistant turns.
  const priorTurns = messages.filter((m) => m.role !== 'system').length - 1;
  const isNewConversation = priorTurns === 0;

  const _perfSessionT0 = performance.now();
  debugLog('PERF:copilot', 'getOrCreateSession starting', { model, isNewConversation });
  const session = await getOrCreateSession(model, systemPrompt, isNewConversation);
  debugLog('PERF:copilot', `session ready +${(performance.now() - _perfSessionT0).toFixed(0)}ms (session acquire)`);
  let fullMessage = '';
  const _perfT0 = performance.now();
  let _perfFirstDelta = false;

  const unsubscribeDelta = session.on('assistant.message_delta', (event) => {
    const delta = event.data.deltaContent;
    if (delta) {
      if (!_perfFirstDelta) {
        _perfFirstDelta = true;
        debugLog('PERF:copilot', `first assistant.message_delta received +${(performance.now() - _perfT0).toFixed(0)}ms since sendAndWait start (approx)`);
      }
      fullMessage += delta;
      callbacks.onDelta(delta);
    }
  });

  if (options.signal) {
    options.signal.addEventListener('abort', () => {
      void session.abort();
    });
  }

  try {
    if (activeSession) {
      activeSession.messageCount++;
    }
    debugLog('PERF:copilot', 'calling session.sendAndWait');
    await session.sendAndWait({ prompt: lastUserMessage.content });
    unsubscribeDelta();
    debugLog('PERF:copilot', `session.sendAndWait resolved +${(performance.now() - _perfT0).toFixed(0)}ms`);

    if (!fullMessage.trim()) {
      throw new Error('GitHub Copilot returned an empty response.');
    }

    return fullMessage;
  } catch (error) {
    unsubscribeDelta();
    // On error, drop the session so next call starts fresh.
    if (activeSession?.session === session) {
      await session.destroy().catch(() => {});
      activeSession = null;
    }
    throw error;
  }
}

export async function copilotTestConnection(model: string): Promise<string> {
  const [client, { approveAll }] = await Promise.all([getClient(), getSdk()]);
  const session = await client.createSession({
    model: model || 'gpt-4o',
    infiniteSessions: { enabled: false },
    onPermissionRequest: approveAll,
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

/**
 * Pre-warm: eagerly start the CLI and create the session so the first user
 * message is not penalised by cold-start overhead. Safe to call multiple times.
 */
export async function warmupCopilotSession(model: string, systemPrompt: string): Promise<void> {
  try {
    await getOrCreateSession(model, systemPrompt, false);
  } catch {
    // Ignore warmup failures — the real request will surface the error.
  }
}

/**
 * Reset the active session (e.g. when the user clears the conversation).
 * A new session is pre-warmed immediately so the next message is fast.
 */
export async function resetCopilotSession(model: string, systemPrompt: string): Promise<void> {
  if (activeSession) {
    await activeSession.session.destroy().catch(() => {});
    activeSession = null;
  }
  // Re-warm immediately so the next message doesn't pay the creation cost.
  await warmupCopilotSession(model, systemPrompt);
}

export async function stopCopilotClient(): Promise<void> {
  if (activeSession) {
    await activeSession.session.destroy().catch(() => {});
    activeSession = null;
  }
  if (clientInstance) {
    await clientInstance.stop().catch(() => {});
    clientInstance = null;
  }
}
