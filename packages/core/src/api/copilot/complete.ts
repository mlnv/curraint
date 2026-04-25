import type { CopilotSession as CopilotSessionType } from '@github/copilot-sdk';
import { getClient } from './client';
import { getSdk } from './sdk';
import type { ChatMessage, ChatResult, TokenUsage } from '../../types';

function extractPrompt(messages: ChatMessage[]): {
  prompt: string;
  systemPrompt: string;
} {
  const lastUser = [...messages].reverse().find((message) => message.role === 'user');
  if (!lastUser) {
    throw new Error('No user message found in conversation.');
  }

  return {
    prompt: lastUser.content,
    systemPrompt: messages.find((message) => message.role === 'system')?.content ?? ''
  };
}

async function createEphemeralSession(
  model: string,
  systemPrompt: string
): Promise<CopilotSessionType> {
  const client = await getClient();
  const { approveAll } = await getSdk();
  return client.createSession({
    model: model || 'gpt-4o',
    streaming: true,
    systemMessage: systemPrompt ? { mode: 'replace', content: systemPrompt } : undefined,
    availableTools: [],
    infiniteSessions: { enabled: false },
    onPermissionRequest: approveAll
  });
}

export async function copilotChatComplete(
  model: string,
  messages: ChatMessage[],
  signal?: AbortSignal
): Promise<ChatResult> {
  const { prompt, systemPrompt } = extractPrompt(messages);
  const session = await createEphemeralSession(model, systemPrompt);
  let fullMessage = '';
  let usage: TokenUsage | undefined;

  if (signal) {
    signal.addEventListener('abort', () => void session.abort());
  }

  const unsubDelta = session.on('assistant.message_delta', (event) => {
    const delta = event.data.deltaContent;
    if (!delta) {
      return;
    }

    fullMessage += delta;
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
    await session.sendAndWait({ prompt });
    unsubDelta();
    unsubUsage();
    if (!fullMessage.trim()) {
      throw new Error('GitHub Copilot returned an empty response.');
    }

    return { message: fullMessage, usage };
  } finally {
    unsubDelta();
    unsubUsage();
    await session.disconnect().catch(() => {});
  }
}