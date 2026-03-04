import { describe, expect, it } from 'vitest';
import {
  getUnclosedReasoningTagStart,
  hasThinkTag,
  parseThinkTags,
  stripLeadingReasoningTag
} from './thinkTags';

describe('parseThinkTags', () => {
  it('returns plain text segment when no think tags exist', () => {
    expect(parseThinkTags('hello')).toEqual([{ type: 'text', content: 'hello' }]);
  });

  it('extracts think blocks and surrounding text', () => {
    const content = 'Before<think>private reasoning</think>After';

    expect(parseThinkTags(content)).toEqual([
      { type: 'text', content: 'Before' },
      { type: 'think', content: 'private reasoning' },
      { type: 'text', content: 'After' }
    ]);
  });

  it('supports multiline think blocks', () => {
    const content = '<think>line one\nline two</think>';

    expect(parseThinkTags(content)).toEqual([
      { type: 'think', content: 'line one\nline two' }
    ]);
  });

  it('extracts reasoning blocks and surrounding text', () => {
    const content = 'Before<reasoning>private reasoning</reasoning>After';

    expect(parseThinkTags(content)).toEqual([
      { type: 'text', content: 'Before' },
      { type: 'think', content: 'private reasoning' },
      { type: 'text', content: 'After' }
    ]);
  });

  it('supports mixed think and reasoning blocks', () => {
    const content = 'A<think>x</think>B<reasoning>y</reasoning>C';

    expect(parseThinkTags(content)).toEqual([
      { type: 'text', content: 'A' },
      { type: 'think', content: 'x' },
      { type: 'text', content: 'B' },
      { type: 'think', content: 'y' },
      { type: 'text', content: 'C' }
    ]);
  });

  it('extracts escaped think blocks', () => {
    const content = 'A&lt;think&gt;x&lt;/think&gt;B';

    expect(parseThinkTags(content)).toEqual([
      { type: 'text', content: 'A' },
      { type: 'think', content: 'x' },
      { type: 'text', content: 'B' }
    ]);
  });

  it('extracts escaped reasoning blocks', () => {
    const content = 'A&lt;reasoning&gt;y&lt;/reasoning&gt;B';

    expect(parseThinkTags(content)).toEqual([
      { type: 'text', content: 'A' },
      { type: 'think', content: 'y' },
      { type: 'text', content: 'B' }
    ]);
  });

  it('parses tags even after hasThinkTag pre-check', () => {
    const content = 'Before<think>private</think>After';

    expect(hasThinkTag(content)).toBe(true);
    expect(parseThinkTags(content)).toEqual([
      { type: 'text', content: 'Before' },
      { type: 'think', content: 'private' },
      { type: 'text', content: 'After' }
    ]);
  });
});

describe('hasThinkTag', () => {
  it('detects think tag blocks', () => {
    expect(hasThinkTag('x<think>y</think>z')).toBe(true);
  });

  it('returns false when no think tags are present', () => {
    expect(hasThinkTag('no tags')).toBe(false);
  });

  it('detects reasoning tag blocks', () => {
    expect(hasThinkTag('x<reasoning>y</reasoning>z')).toBe(true);
  });

  it('detects escaped tag blocks', () => {
    expect(hasThinkTag('x&lt;think&gt;y&lt;/think&gt;z')).toBe(true);
    expect(hasThinkTag('x&lt;reasoning&gt;y&lt;/reasoning&gt;z')).toBe(true);
  });
});

describe('getUnclosedReasoningTagStart', () => {
  it('returns -1 when all tags are closed', () => {
    expect(getUnclosedReasoningTagStart('A<think>x</think>B')).toBe(-1);
    expect(getUnclosedReasoningTagStart('A<reasoning>x</reasoning>B')).toBe(-1);
  });

  it('returns start index for unclosed raw tag', () => {
    const content = 'Prefix <think>partial';
    expect(getUnclosedReasoningTagStart(content)).toBe(content.indexOf('<think>'));
  });

  it('returns start index for unclosed escaped tag', () => {
    const content = 'Prefix &lt;reasoning&gt;partial';
    expect(getUnclosedReasoningTagStart(content)).toBe(
      content.indexOf('&lt;reasoning&gt;')
    );
  });
});

describe('stripLeadingReasoningTag', () => {
  it('removes raw opening think tag', () => {
    expect(stripLeadingReasoningTag('<think>abc')).toBe('abc');
  });

  it('removes raw opening reasoning tag', () => {
    expect(stripLeadingReasoningTag('<reasoning>abc')).toBe('abc');
  });

  it('removes escaped opening tag', () => {
    expect(stripLeadingReasoningTag('&lt;think&gt;abc')).toBe('abc');
  });
});
