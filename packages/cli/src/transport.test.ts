import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompactedContext, EndpointSettings } from '@curraint/core';

const {
  buildModelSummaryMessages,
  chatCompletion,
  chatCompletionStream,
  composeConversation,
  copilotChatComplete,
  copilotChatStream,
  resetCopilotSession,
} = vi.hoisted(() => ({
  buildModelSummaryMessages: vi.fn(),
  chatCompletion: vi.fn(),
  chatCompletionStream: vi.fn(),
  composeConversation: vi.fn(),
  copilotChatComplete: vi.fn(),
  copilotChatStream: vi.fn(),
  resetCopilotSession: vi.fn(),
}));

vi.mock('@curraint/core', () => ({
  buildModelSummaryMessages,
  chatCompletion,
  chatCompletionStream,
  composeConversation,
  copilotChatComplete,
  copilotChatStream,
  resetCopilotSession,
  ENABLE_COPILOT_PROVIDER: true,
}));

import { buildTransport } from './transport';

const baseSettings: EndpointSettings = {
  provider: 'openai',
  apiKey: 'test-key',
  baseUrl: 'https://example.com/v1',
  model: 'test-model',
  systemPrompt: 'System prompt',
  contextMaxMessages: 40,
  contextMaxCharacters: 24000,
  enableSessionSaving: true,
};

const compactedContext: CompactedContext = {
  summary: 'Earlier messages summarized',
  sourceMessageCount: 2,
  sourceCharacterCount: 120,
};

const messages = [{ role: 'user' as const, content: 'Hello' }];
const summaryPromptMessages = [
  { role: 'system' as const, content: 'Summarize' },
  { role: 'user' as const, content: 'Transcript' },
];

describe('buildTransport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildModelSummaryMessages.mockReturnValue(summaryPromptMessages);
    composeConversation.mockReturnValue(messages);
    chatCompletionStream.mockResolvedValue({ message: 'OpenAI reply' });
    chatCompletion.mockResolvedValue({ message: 'Fallback reply' });
    copilotChatComplete.mockResolvedValue({ message: 'Copilot summary' });
    copilotChatStream.mockResolvedValue({ message: 'Copilot reply' });
  });

  it('uses the model prompt builder for OpenAI summaries', async () => {
    const transport = buildTransport(baseSettings);

    await expect(transport.summarizeMessages(messages)).resolves.toBe('Fallback reply');

    expect(buildModelSummaryMessages).toHaveBeenCalledWith(messages);
    expect(chatCompletion).toHaveBeenCalledWith(baseSettings, summaryPromptMessages);
  });

  it('uses the copilot completion helper for Copilot summaries', async () => {
    const transport = buildTransport({ ...baseSettings, provider: 'copilot' });

    await expect(transport.summarizeMessages(messages)).resolves.toBe('Copilot summary');

    expect(buildModelSummaryMessages).toHaveBeenCalledWith(messages);
    expect(copilotChatComplete).toHaveBeenCalledWith('test-model', summaryPromptMessages);
  });

  it('passes compacted context into OpenAI request composition', async () => {
    const transport = buildTransport(baseSettings);

    await transport.streamChat(messages, vi.fn(), { compactedContext });

    expect(composeConversation).toHaveBeenCalledWith(
      baseSettings,
      messages,
      compactedContext,
    );
  });

  it('passes compacted context into Copilot request composition', async () => {
    const transport = buildTransport({ ...baseSettings, provider: 'copilot' });

    await transport.streamChat(messages, vi.fn(), { compactedContext });

    expect(composeConversation).toHaveBeenCalledWith(
      { ...baseSettings, provider: 'copilot' },
      messages,
      compactedContext,
    );
  });
});