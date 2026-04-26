import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../types';
import {
  buildModelSummaryMessages,
  buildSummarySystemPrompt,
  formatConversation,
} from './model-summary';

describe('buildSummarySystemPrompt', () => {
  it('uses the default prompt limits', () => {
    expect(buildSummarySystemPrompt()).toContain('Keep the result under 8 bullet points and under 1200 characters.');
  });

  it('normalizes custom limits to positive integers', () => {
    expect(buildSummarySystemPrompt({ maxBullets: 3.9, maxCharacters: 90.8 })).toContain(
      'Keep the result under 3 bullet points and under 90 characters.'
    );
    expect(buildSummarySystemPrompt({ maxBullets: 0, maxCharacters: Number.NaN })).toContain(
      'Keep the result under 1 bullet points and under 1 characters.'
    );
  });
});

describe('formatConversation', () => {
  it('uppercases roles, trims content, and separates messages with blank lines', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: '  hello  ' },
      { role: 'assistant', content: '\nworld\n' },
    ];

    expect(formatConversation(messages)).toBe('USER:\nhello\n\nASSISTANT:\nworld');
  });
});

describe('buildModelSummaryMessages', () => {
  it('builds the system and user summary prompt messages', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: '  hello  ' },
      { role: 'assistant', content: ' world ' },
    ];

    expect(buildModelSummaryMessages(messages, { maxBullets: 2, maxCharacters: 80 })).toEqual([
      {
        role: 'system',
        content: buildSummarySystemPrompt({ maxBullets: 2, maxCharacters: 80 }),
      },
      {
        role: 'user',
        content: [
          'Summarize the earlier conversation turns below so they can replace the original messages in future context.',
          'Keep important facts and open threads, but stay concise.',
          '',
          'USER:\nhello\n\nASSISTANT:\nworld',
        ].join('\n')
      },
    ]);
  });
});