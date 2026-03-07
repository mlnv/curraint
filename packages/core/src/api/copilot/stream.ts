import type { CopilotSession as CopilotSessionType } from '@github/copilot-sdk';
import { debugLog } from '../../debug/log';
import type { ChatMessage } from '../../types';
import { getOrCreateSession, incrementMessageCount, invalidateSession } from './session';
import type { CopilotStreamCallbacks, CopilotStreamOptions } from './types';

function extractConversationInfo(messages: ChatMessage[]): {
  lastUserContent: string;
  systemPrompt: string;
  isNewConversation: boolean;
} {
  const userMessages = messages.filter((m) => m.role === 'user');
  const lastUser = userMessages[userMessages.length - 1];
  if (!lastUser) throw new Error('No user message found in conversation.');
  const systemPrompt = messages.find((m) => m.role === 'system')?.content ?? '';
  const priorTurns = messages.filter((m) => m.role !== 'system').length - 1;
  return { lastUserContent: lastUser.content, systemPrompt, isNewConversation: priorTurns === 0 };
}

async function streamFromSession(
  session: CopilotSessionType,
  content: string,
  callbacks: CopilotStreamCallbacks,
  signal?: AbortSignal
): Promise<string> {
  let fullMessage = '';
  const t0 = performance.now();
  let firstDelta = false;

  if (signal) signal.addEventListener('abort', () => void session.abort());

  const unsubscribe = session.on('assistant.message_delta', (event) => {
    const delta = event.data.deltaContent;
    if (!delta) return;
    if (!firstDelta) {
      firstDelta = true;
      debugLog('PERF:copilot', `first delta +${(performance.now() - t0).toFixed(0)}ms`);
    }
    fullMessage += delta;
    callbacks.onDelta(delta);
  });

  try {
    incrementMessageCount();
    await session.sendAndWait({ prompt: content });
    unsubscribe();
    if (!fullMessage.trim()) throw new Error('GitHub Copilot returned an empty response.');
    return fullMessage;
  } catch (error) {
    unsubscribe();
    await invalidateSession(session);
    throw error;
  }
}

export async function copilotChatStream(
  model: string,
  messages: ChatMessage[],
  callbacks: CopilotStreamCallbacks,
  options: CopilotStreamOptions = {}
): Promise<string> {
  const { lastUserContent, systemPrompt, isNewConversation } = extractConversationInfo(messages);
  debugLog('PERF:copilot', 'getOrCreateSession starting', { model, isNewConversation });
  const session = await getOrCreateSession(model, systemPrompt, isNewConversation);
  debugLog('PERF:copilot', 'session ready');
  return streamFromSession(session, lastUserContent, callbacks, options.signal);
}
