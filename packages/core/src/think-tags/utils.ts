import {
  THINK_BLOCK_REGEX,
  REASONING_BLOCK_REGEX,
  ESCAPED_THINK_BLOCK_REGEX,
  ESCAPED_REASONING_BLOCK_REGEX,
  OPEN_OR_CLOSE_REASONING_TAG_REGEX,
  OPEN_REASONING_TAG_PREFIX_REGEX
} from './patterns';

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

export function getUnclosedReasoningTagStart(content: string): number {
  OPEN_OR_CLOSE_REASONING_TAG_REGEX.lastIndex = 0;
  const stack: number[] = [];

  for (const match of content.matchAll(OPEN_OR_CLOSE_REASONING_TAG_REGEX)) {
    const fullMatch = match[1] ?? '';
    const matchIndex = match.index ?? -1;
    if (matchIndex < 0) continue;

    if (/\/\s*(think|reasoning)/i.test(fullMatch)) {
      if (stack.length > 0) stack.pop();
    } else {
      stack.push(matchIndex);
    }
  }

  return stack.length > 0 ? stack[0]! : -1;
}

export function stripLeadingReasoningTag(content: string): string {
  return content.replace(OPEN_REASONING_TAG_PREFIX_REGEX, '');
}
