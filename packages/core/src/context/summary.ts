import type { ChatMessage } from '../types';
import { CONTEXT_SAFETY_LIMIT_BOUNDS } from './types';

export function estimateMessageCost(message: ChatMessage): number {
  return message.content.length + 12;
}

function compactContent(content: string): string {
  const compacted = content.replace(/\s+/g, ' ').trim();
  if (compacted.length <= CONTEXT_SAFETY_LIMIT_BOUNDS.summarySnippetChars) return compacted;
  return `${compacted.slice(0, CONTEXT_SAFETY_LIMIT_BOUNDS.summarySnippetChars)}…`;
}

function formatMessageLine(message: ChatMessage): string {
  const role = message.role[0].toUpperCase() + message.role.slice(1);
  return `- ${role}: ${compactContent(message.content)}`;
}

export function buildTruncationSummary(messages: ChatMessage[]): string {
  const source = messages.slice(-CONTEXT_SAFETY_LIMIT_BOUNDS.summarySourceMessages);
  return [
    'Earlier conversation was truncated to stay within model context limits.',
    'Summary of truncated messages:',
    ...source.map(formatMessageLine)
  ].join('\n');
}
