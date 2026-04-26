import { describe, expect, it } from 'vitest';
import { estimateMessageCost } from '../context';
import { DEFAULT_SETTINGS } from './defaults';
import { composeConversation } from './composer';
import { getContextUsage } from './context-usage';
import { normalizeSettings } from './normalizer';

function getExpectedPercent(
  settings: typeof DEFAULT_SETTINGS,
  messages: Parameters<typeof composeConversation>[1],
  compactedContext?: Parameters<typeof composeConversation>[2],
): number {
  const composed = composeConversation(settings, messages, compactedContext ?? null);
  const usedMessages = composed.length;
  const usedCharacters = composed.reduce(
    (total, message) => total + estimateMessageCost(message),
    0,
  );
  const messagePercent = settings.contextMaxMessages > 0
    ? Math.max(0, Math.min(100, Math.round((usedMessages / settings.contextMaxMessages) * 100)))
    : 0;
  const characterPercent = settings.contextMaxCharacters > 0
    ? Math.max(0, Math.min(100, Math.round((usedCharacters / settings.contextMaxCharacters) * 100)))
    : 0;

  return Math.max(messagePercent, characterPercent);
}

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
    const result = normalizeSettings({ contextMaxMessages: 9999, contextMaxCharacters: 9_999_999 });
    expect(result.contextMaxMessages).toBe(1200);
    expect(result.contextMaxCharacters).toBe(2_000_000);
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
    expect(result[0]?.role).toBe('system');
    expect(result[0]?.content).toContain('System message');
    expect(result[0]?.content).toContain('Earlier conversation was truncated');
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
      { role: 'system', content: 'System message\n\nCompacted summary' },
      { role: 'user', content: 'Recent user message' },
      { role: 'assistant', content: 'Recent assistant message' }
    ]);
  });

  it('keeps the composed request within message limits after adding the system prompt', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      systemPrompt: 'System message',
      contextMaxMessages: 4,
      contextMaxCharacters: 4000
    };
    const messages = [
      { role: 'user' as const, content: 'Message 1' },
      { role: 'assistant' as const, content: 'Reply 1' },
      { role: 'user' as const, content: 'Message 2' },
      { role: 'assistant' as const, content: 'Reply 2' }
    ];

    const result = composeConversation(settings, messages);

    expect(result).toHaveLength(4);
    expect(result[0]).toMatchObject({
      role: 'system',
      content: expect.stringContaining('System message')
    });
    expect(result[0]?.content).toContain('Earlier conversation was truncated');
    expect(getContextUsage(settings, messages).percent).toBe(getExpectedPercent(settings, messages));
    expect(getContextUsage(settings, messages).hasCompactedContext).toBe(false);
    expect(getContextUsage(settings, messages).compactedMessages).toBe(0);
  });

  it('keeps the composed request within message limits after adding compacted context', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      systemPrompt: 'System message',
      contextMaxMessages: 4,
      contextMaxCharacters: 4000
    };
    const messages = [
      { role: 'user' as const, content: 'Older user message' },
      { role: 'assistant' as const, content: 'Older assistant message' },
      { role: 'user' as const, content: 'Recent user message 1' },
      { role: 'assistant' as const, content: 'Recent assistant message 1' },
      { role: 'user' as const, content: 'Recent user message 2' }
    ];
    const compactedContext = {
      summary: 'Compacted summary',
      sourceMessageCount: 2,
      sourceCharacterCount: 120
    };

    const result = composeConversation(settings, messages, compactedContext);

    expect(result).toHaveLength(4);
    expect(result[0]).toMatchObject({
      role: 'system',
      content: expect.stringContaining('System message')
    });
    expect(result[0]?.content).toContain('Compacted summary');
    expect(getContextUsage(settings, messages, compactedContext).percent).toBe(
      getExpectedPercent(settings, messages, compactedContext),
    );
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
      usedMessages: 3,
      maxMessages: 10,
      tone: 'safe',
      hasCompactedContext: true,
      compactedMessages: 2,
      percent: getExpectedPercent(
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
      )
    });
    expect(usage.usedCharacters).toBeGreaterThan(0);
  });
});
