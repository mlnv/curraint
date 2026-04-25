import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompactedContext, EndpointSettings } from '@curraint/core';

const {
  chatCompletion,
  chatCompletionStream,
  composeConversation,
  copilotChatStream,
  resetCopilotSession,
} = vi.hoisted(() => ({
  chatCompletion: vi.fn(),
  chatCompletionStream: vi.fn(),
  composeConversation: vi.fn(),
  copilotChatStream: vi.fn(),
  resetCopilotSession: vi.fn(),
}));

vi.mock('@curraint/core', () => ({
  chatCompletion,
  chatCompletionStream,
  composeConversation,
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

describe('buildTransport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    composeConversation.mockReturnValue(messages);
    chatCompletionStream.mockResolvedValue({ message: 'OpenAI reply' });
    chatCompletion.mockResolvedValue({ message: 'Fallback reply' });
    copilotChatStream.mockResolvedValue({ message: 'Copilot reply' });
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