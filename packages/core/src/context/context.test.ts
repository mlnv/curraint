import { describe, expect, it } from 'vitest';
import {
  CONTEXT_SAFETY_LIMIT_BOUNDS,
  normalizeContextLimit,
  truncateConversationForContext
} from '.';

describe('normalizeContextLimit', () => {
  it('returns fallback for invalid values', () => {
    expect(normalizeContextLimit('abc', 40, 4, 120)).toBe(40);
  });

  it('applies min and max bounds', () => {
    expect(normalizeContextLimit(1, 40, 4, 120)).toBe(4);
    expect(normalizeContextLimit(999, 40, 4, 120)).toBe(120);
  });
});

describe('truncateConversationForContext', () => {
  it('keeps messages when within limits', () => {
    const messages = [{ role: 'user' as const, content: 'hello' }];
    const result = truncateConversationForContext(messages, {
      maxMessages: 40,
      maxCharacters: 24000
    });

    expect(result.keptMessages).toEqual(messages);
    expect(result.summary).toBeNull();
  });

  it('returns summary when messages are truncated', () => {
    const messages = Array.from({ length: 60 }, (_, index) => ({
      role: (index % 2 === 0 ? 'user' : 'assistant') as const,
      content: `Message ${index + 1}`
    }));

    const result = truncateConversationForContext(messages, {
      maxMessages: 10,
      maxCharacters: 24000
    });

    expect(result.keptMessages.length).toBe(10);
    expect(result.summary).toContain('Earlier conversation was truncated');
    expect(result.summary).toContain('Summary of truncated messages:');
  });

  it('uses configured summary source limits', () => {
    const messages = Array.from({ length: 100 }, (_, index) => ({
      role: 'user' as const,
      content: `M${index}`
    }));

    const result = truncateConversationForContext(messages, {
      maxMessages: 5,
      maxCharacters: 24000
    });

    const lineCount = (result.summary ?? '').split('\n').length;
    expect(lineCount).toBeLessThanOrEqual(
      2 + CONTEXT_SAFETY_LIMIT_BOUNDS.summarySourceMessages
    );
  });
});
