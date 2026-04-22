import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './defaults';
import { composeConversation } from './composer';
import { getContextUsage } from './context-usage';
import { normalizeSettings } from './normalizer';

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
      contextMaxMessages: 40,
      contextMaxCharacters: 24000,
      enableSessionSaving: false
    });
  });

  it('uses defaults for missing fields', () => {
    const result = normalizeSettings({ apiKey: 'abc' });
    expect(result).toEqual({ ...DEFAULT_SETTINGS, apiKey: 'abc' });
  });

  it('falls back to openai provider for invalid provider values', () => {
    const result = normalizeSettings({ provider: 'invalid-provider' as never });
    expect(result.provider).toBe('openai');
  });

  it('normalizes context limits into allowed bounds', () => {
    const result = normalizeSettings({ contextMaxMessages: 9999, contextMaxCharacters: 100 });
    expect(result.contextMaxMessages).toBe(120);
    expect(result.contextMaxCharacters).toBe(4000);
  });

  it('defaults enableSessionSaving to false when not provided', () => {
    const result = normalizeSettings({ apiKey: 'key' });
    expect(result.enableSessionSaving).toBe(false);
  });

  it('preserves a truthy enableSessionSaving value', () => {
    const result = normalizeSettings({ enableSessionSaving: true });
    expect(result.enableSessionSaving).toBe(true);
  });

  it('coerces non-boolean enableSessionSaving to the default', () => {
    const result = normalizeSettings({ enableSessionSaving: 'yes' as unknown as boolean });
    expect(result.enableSessionSaving).toBe(false);
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
    expect(composeConversation(settings, messages)).toEqual(messages);
  });

  it('truncates long history and adds summary system message', () => {
    const settings = { ...DEFAULT_SETTINGS, systemPrompt: 'System message' };
    const messages = Array.from({ length: 55 }, (_, index) => ({
      role: (index % 2 === 0 ? 'user' : 'assistant') as const,
      content: `Message ${index + 1}`
    }));
    const result = composeConversation(settings, messages);
    expect(result[0]).toEqual({ role: 'system', content: 'System message' });
    expect(result[1]?.role).toBe('system');
    expect(result[1]?.content).toContain('Earlier conversation was truncated');
  });

  it('adds truncation summary even without explicit system prompt', () => {
    const settings = { ...DEFAULT_SETTINGS, systemPrompt: '' };
    const longMessage = 'x'.repeat(2000);
    const messages = Array.from({ length: 20 }, (_, index) => ({
      role: (index % 2 === 0 ? 'user' : 'assistant') as const,
      content: `${index}-${longMessage}`
    }));
    const result = composeConversation(settings, messages);
    expect(result[0]?.role).toBe('system');
    expect(result[0]?.content).toContain('Summary of truncated messages:');
  });

  it('prepends hidden compacted context without changing visible messages', () => {
    const settings = { ...DEFAULT_SETTINGS, systemPrompt: 'System message' };
    const messages = [
      { role: 'user' as const, content: 'Older user message' },
      { role: 'assistant' as const, content: 'Older assistant message' },
      { role: 'user' as const, content: 'Recent user message' },
      { role: 'assistant' as const, content: 'Recent assistant message' }
    ];

    const result = composeConversation(settings, messages, {
      summary: 'Compacted summary',
      sourceMessageCount: 2,
      sourceCharacterCount: 120
    });

    expect(result).toEqual([
      { role: 'system', content: 'System message' },
      { role: 'system', content: 'Compacted summary' },
      { role: 'user', content: 'Recent user message' },
      { role: 'assistant', content: 'Recent assistant message' }
    ]);
  });

  it('calculates context usage from the composed request', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      systemPrompt: 'System message',
      contextMaxMessages: 10,
      contextMaxCharacters: 1000
    };
    const usage = getContextUsage(
      settings,
      [
        { role: 'user' as const, content: 'Older user message' },
        { role: 'assistant' as const, content: 'Older assistant message' },
        { role: 'user' as const, content: 'Recent user message' },
        { role: 'assistant' as const, content: 'Recent assistant message' }
      ],
      {
        summary: 'Compacted summary',
        sourceMessageCount: 2,
        sourceCharacterCount: 120
      }
    );

    expect(usage).toMatchObject({
      usedMessages: 4,
      maxMessages: 10,
      hasCompactedContext: true,
      compactedMessages: 2,
      percent: 40
    });
    expect(usage.usedCharacters).toBeGreaterThan(0);
  });
});
