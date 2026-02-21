export type ThinkSegment =
  | { type: 'text'; content: string }
  | { type: 'think'; content: string };

const THINK_BLOCK_REGEX = /<\s*think\s*>([\s\S]*?)<\s*\/\s*think\s*>/gi;
const REASONING_BLOCK_REGEX =
  /<\s*reasoning\s*>([\s\S]*?)<\s*\/\s*reasoning\s*>/gi;
const ESCAPED_THINK_BLOCK_REGEX =
  /&lt;\s*think\s*&gt;([\s\S]*?)&lt;\s*\/\s*think\s*&gt;/gi;
const ESCAPED_REASONING_BLOCK_REGEX =
  /&lt;\s*reasoning\s*&gt;([\s\S]*?)&lt;\s*\/\s*reasoning\s*&gt;/gi;

export function parseThinkTags(content: string): ThinkSegment[] {
  const segments: ThinkSegment[] = [];
  let cursor = 0;

  THINK_BLOCK_REGEX.lastIndex = 0;
  REASONING_BLOCK_REGEX.lastIndex = 0;
  ESCAPED_THINK_BLOCK_REGEX.lastIndex = 0;
  ESCAPED_REASONING_BLOCK_REGEX.lastIndex = 0;

  const matches = [
    ...content.matchAll(THINK_BLOCK_REGEX),
    ...content.matchAll(REASONING_BLOCK_REGEX),
    ...content.matchAll(ESCAPED_THINK_BLOCK_REGEX),
    ...content.matchAll(ESCAPED_REASONING_BLOCK_REGEX)
  ].sort((left, right) => (left.index ?? 0) - (right.index ?? 0));

  for (const match of matches) {
    const matchIndex = match.index ?? 0;
    const fullMatch = match[0] ?? '';
    const thinkContent = match[1] ?? '';

    if (matchIndex > cursor) {
      segments.push({
        type: 'text',
        content: content.slice(cursor, matchIndex)
      });
    }

    segments.push({
      type: 'think',
      content: thinkContent
    });

    cursor = matchIndex + fullMatch.length;
  }

  if (cursor < content.length) {
    segments.push({
      type: 'text',
      content: content.slice(cursor)
    });
  }

  if (segments.length === 0) {
    return [{ type: 'text', content }];
  }

  return segments;
}

export function hasThinkTag(content: string): boolean {
  THINK_BLOCK_REGEX.lastIndex = 0;
  REASONING_BLOCK_REGEX.lastIndex = 0;
  ESCAPED_THINK_BLOCK_REGEX.lastIndex = 0;
  ESCAPED_REASONING_BLOCK_REGEX.lastIndex = 0;

  return (
    THINK_BLOCK_REGEX.test(content) ||
    REASONING_BLOCK_REGEX.test(content) ||
    ESCAPED_THINK_BLOCK_REGEX.test(content) ||
    ESCAPED_REASONING_BLOCK_REGEX.test(content)
  );
}
