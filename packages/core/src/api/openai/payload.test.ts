import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../../types';
import type { EndpointSettings } from '../../settings/types';
import { buildOpenAiPayload, sanitizeOpenAiMessages, supportsOpenAiStreamOptions } from './payload';

const baseSettings: EndpointSettings = {
  provider: 'openai',
  apiKey: 'test-key',
  baseUrl: 'https://api.example.com',
  model: '  test-model  ',
  systemPrompt: '',
  contextMaxMessages: 40,
  contextMaxCharacters: 24000,
  enableSessionSaving: false,
};

describe('sanitizeOpenAiMessages', () => {
  it('keeps only role and content fields', () => {
    expect(
      sanitizeOpenAiMessages([
        {
          role: 'user',
          content: 'Hello',
          timestamp: 123,
          durationMs: 456,
          usage: { total_tokens: 10 },
        },
      ])
    ).toEqual([{ role: 'user', content: 'Hello' }]);
  });

  it('preserves empty strings and normalizes undefined content to empty strings', () => {
    const messages = [
      { role: 'user', content: '', timestamp: 123 },
      { role: 'assistant', content: undefined, usage: { total_tokens: 1 } },
    ] as unknown as ChatMessage[];

    expect(sanitizeOpenAiMessages(messages)).toEqual([
      { role: 'user', content: '' },
      { role: 'assistant', content: '' },
    ]);
  });
});

describe('supportsOpenAiStreamOptions', () => {
  it('enables usage stream options only for supported providers', () => {
    expect(supportsOpenAiStreamOptions('openai')).toBe(true);
    expect(supportsOpenAiStreamOptions('copilot')).toBe(true);
    expect(supportsOpenAiStreamOptions('custom')).toBe(false);
    expect(supportsOpenAiStreamOptions('lmstudio')).toBe(false);
  });
});

describe('buildOpenAiPayload', () => {
  it('trims the model and sanitizes messages for non-streaming requests', () => {
    expect(
      buildOpenAiPayload(baseSettings, [
        {
          role: 'assistant',
          content: 'Done',
          timestamp: 1,
          durationMs: 2,
        },
      ])
    ).toEqual({
      model: 'test-model',
      messages: [{ role: 'assistant', content: 'Done' }],
    });
  });

  it('adds usage stream options only for providers that support them', () => {
    expect(
      buildOpenAiPayload(baseSettings, [{ role: 'user', content: 'Hi' }], { stream: true })
    ).toEqual({
      model: 'test-model',
      messages: [{ role: 'user', content: 'Hi' }],
      stream: true,
      stream_options: { include_usage: true },
    });

    expect(
      buildOpenAiPayload(
        { ...baseSettings, provider: 'custom' },
        [{ role: 'user', content: 'Hi' }],
        { stream: true }
      )
    ).toEqual({
      model: 'test-model',
      messages: [{ role: 'user', content: 'Hi' }],
      stream: true,
    });
  });
});
