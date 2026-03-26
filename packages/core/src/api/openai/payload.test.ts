import { describe, expect, it } from 'vitest';
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
