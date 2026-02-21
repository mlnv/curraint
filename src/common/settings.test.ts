import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './defaults';
import { composeConversation, normalizeSettings } from './settings';

describe('normalizeSettings', () => {
  it('trims values and fills defaults', () => {
    const result = normalizeSettings({
      apiKey: '  key  ',
      baseUrl: '  https://api.example.com/v1  ',
      model: '  my-model  ',
      systemPrompt: '  helper  '
    });

    expect(result).toEqual({
      provider: 'openai',
      apiKey: 'key',
      baseUrl: 'https://api.example.com/v1',
      model: 'my-model',
      systemPrompt: 'helper',
      enableThinkTagFolding: true
    });
  });

  it('uses defaults for missing fields', () => {
    const result = normalizeSettings({ apiKey: 'abc' });

    expect(result).toEqual({
      ...DEFAULT_SETTINGS,
      apiKey: 'abc'
    });
  });

  it('falls back to openai provider for invalid provider values', () => {
    const result = normalizeSettings({
      provider: 'invalid-provider' as never
    });

    expect(result.provider).toBe('openai');
  });
});

describe('composeConversation', () => {
  it('prepends system prompt when present', () => {
    const settings = { ...DEFAULT_SETTINGS, systemPrompt: 'System message' };
    const messages = [{ role: 'user' as const, content: 'Hello' }];

    const result = composeConversation(settings, messages);

    expect(result).toEqual([
      { role: 'system', content: 'System message' },
      { role: 'user', content: 'Hello' }
    ]);
  });

  it('returns same messages when no system prompt', () => {
    const settings = { ...DEFAULT_SETTINGS, systemPrompt: '' };
    const messages = [{ role: 'user' as const, content: 'Hello' }];

    const result = composeConversation(settings, messages);

    expect(result).toEqual(messages);
  });
});
