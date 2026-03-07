import {
  THINK_BLOCK_REGEX,
  REASONING_BLOCK_REGEX,
  ESCAPED_THINK_BLOCK_REGEX,
  ESCAPED_REASONING_BLOCK_REGEX
} from './patterns';
import type { ThinkSegment } from './types';

function collectMatches(content: string): RegExpMatchArray[] {
  THINK_BLOCK_REGEX.lastIndex = 0;
  REASONING_BLOCK_REGEX.lastIndex = 0;
  ESCAPED_THINK_BLOCK_REGEX.lastIndex = 0;
  ESCAPED_REASONING_BLOCK_REGEX.lastIndex = 0;

  return [
    ...content.matchAll(THINK_BLOCK_REGEX),
    ...content.matchAll(REASONING_BLOCK_REGEX),
    ...content.matchAll(ESCAPED_THINK_BLOCK_REGEX),
    ...content.matchAll(ESCAPED_REASONING_BLOCK_REGEX)
  ].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}

export function parseThinkTags(content: string): ThinkSegment[] {
  const segments: ThinkSegment[] = [];
  const matches = collectMatches(content);
  let cursor = 0;

  for (const match of matches) {
    const matchIndex = match.index ?? 0;
    if (matchIndex > cursor) {
      segments.push({ type: 'text', content: content.slice(cursor, matchIndex) });
    }
    segments.push({ type: 'think', content: match[1] ?? '' });
    cursor = matchIndex + (match[0] ?? '').length;
  }

  if (cursor < content.length) {
    segments.push({ type: 'text', content: content.slice(cursor) });
  }

  return segments.length > 0 ? segments : [{ type: 'text', content }];
}
