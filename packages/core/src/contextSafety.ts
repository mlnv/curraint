import type { ChatMessage } from './types';

export const CONTEXT_SAFETY_LIMIT_BOUNDS = {
  minMessages: 4,
  maxMessages: 120,
  minCharacters: 4_000,
  maxCharacters: 200_000,
  summarySourceMessages: 8,
  summarySnippetChars: 180
} as const;

export type ContextSafetyLimits = {
  maxMessages: number;
  maxCharacters: number;
};

export type TruncatedConversation = {
  keptMessages: ChatMessage[];
  summary: string | null;
};

export function normalizeContextLimit(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  const rounded = Math.round(numeric);
  if (rounded < min) {
    return min;
  }

  if (rounded > max) {
    return max;
  }

  return rounded;
}

function estimateMessageCost(message: ChatMessage): number {
  return message.content.length + 12;
}

function compactMessageContent(content: string): string {
  const compacted = content.replace(/\s+/g, ' ').trim();
  if (compacted.length <= CONTEXT_SAFETY_LIMIT_BOUNDS.summarySnippetChars) {
    return compacted;
  }

  return `${compacted.slice(0, CONTEXT_SAFETY_LIMIT_BOUNDS.summarySnippetChars)}…`;
}

function buildTruncationSummary(messages: ChatMessage[]): string {
  const source = messages.slice(-CONTEXT_SAFETY_LIMIT_BOUNDS.summarySourceMessages);
  const lines = source.map((message) => {
    const roleLabel = message.role[0].toUpperCase() + message.role.slice(1);
    return `- ${roleLabel}: ${compactMessageContent(message.content)}`;
  });

  return [
    'Earlier conversation was truncated to stay within model context limits.',
    'Summary of truncated messages:',
    ...lines
  ].join('\n');
}

export function truncateConversationForContext(
  messages: ChatMessage[],
  limits: ContextSafetyLimits
): TruncatedConversation {
  const nonEmptyMessages = messages.filter((message) => message.content.trim().length > 0);
  const keptReversed: ChatMessage[] = [];
  let totalCharacters = 0;

  for (let index = nonEmptyMessages.length - 1; index >= 0; index -= 1) {
    const current = nonEmptyMessages[index];
    const currentCost = estimateMessageCost(current);

    if (keptReversed.length >= limits.maxMessages) {
      break;
    }

    if (totalCharacters + currentCost > limits.maxCharacters) {
      break;
    }

    keptReversed.push(current);
    totalCharacters += currentCost;
  }

  const keptMessages = keptReversed.reverse();
  if (keptMessages.length === nonEmptyMessages.length) {
    return { keptMessages, summary: null };
  }

  const droppedCount = nonEmptyMessages.length - keptMessages.length;
  const droppedMessages = nonEmptyMessages.slice(0, droppedCount);
  const summary = buildTruncationSummary(droppedMessages);

  return { keptMessages, summary };
}
