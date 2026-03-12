import type { CopilotSession as CopilotSessionType } from '@github/copilot-sdk';
import { debugLog } from '../../debug/log';
import type { ChatMessage, ChatResult, TokenUsage } from '../../types';
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
): Promise<ChatResult> {
  let fullMessage = '';
  let usage: TokenUsage | undefined;
  const t0 = performance.now();
  let firstDelta = false;

  if (signal) signal.addEventListener('abort', () => void session.abort());

  const unsubDelta = session.on('assistant.message_delta', (event) => {
    const delta = event.data.deltaContent;
    if (!delta) return;
    if (!firstDelta) {
      firstDelta = true;
      debugLog('PERF:copilot', `first delta +${(performance.now() - t0).toFixed(0)}ms`);
    }
    fullMessage += delta;
    callbacks.onDelta(delta);
  });

  const unsubUsage = session.on('assistant.usage', (event) => {
    const data = event.data;
    const inputTokens = data.inputTokens ?? 0;
    const outputTokens = data.outputTokens ?? 0;
    usage = {
      prompt_tokens: inputTokens,
      completion_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
    };
  });

  try {
    incrementMessageCount();
    await session.sendAndWait({ prompt: content });
    unsubDelta();
    unsubUsage();
    if (!fullMessage.trim()) throw new Error('GitHub Copilot returned an empty response.');
    return { message: fullMessage, usage };
  } catch (error) {
    unsubDelta();
    unsubUsage();
    await invalidateSession(session);
    throw error;
  }
}

export async function copilotChatStream(
  model: string,
  messages: ChatMessage[],
  callbacks: CopilotStreamCallbacks,
  options: CopilotStreamOptions = {}
): Promise<ChatResult> {
  const { lastUserContent, systemPrompt, isNewConversation } = extractConversationInfo(messages);
  debugLog('PERF:copilot', 'getOrCreateSession starting', { model, isNewConversation });
  const session = await getOrCreateSession(model, systemPrompt, isNewConversation);
  debugLog('PERF:copilot', 'session ready');
  return streamFromSession(session, lastUserContent, callbacks, options.signal);
}
