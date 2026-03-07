import type { ChatMessage } from '../types';
import { estimateMessageCost, buildTruncationSummary } from './summary';
import type { ContextSafetyLimits, TruncatedConversation } from './types';

function collectKeptMessages(
  messages: ChatMessage[],
  limits: ContextSafetyLimits
): ChatMessage[] {
  const kept: ChatMessage[] = [];
  let totalChars = 0;

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    const cost = estimateMessageCost(msg);
    if (kept.length >= limits.maxMessages || totalChars + cost > limits.maxCharacters) break;
    kept.push(msg);
    totalChars += cost;
  }

  return kept.reverse();
}

export function truncateConversationForContext(
  messages: ChatMessage[],
  limits: ContextSafetyLimits
): TruncatedConversation {
  const nonEmpty = messages.filter((m) => m.content.trim().length > 0);
  const keptMessages = collectKeptMessages(nonEmpty, limits);

  if (keptMessages.length === nonEmpty.length) return { keptMessages, summary: null };

  const dropped = nonEmpty.slice(0, nonEmpty.length - keptMessages.length);
  return { keptMessages, summary: buildTruncationSummary(dropped) };
}
