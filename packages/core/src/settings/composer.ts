import { buildTruncationSummary, estimateMessageCost } from '../context';
import type { CompactedContext } from '../context/types';
import type { ChatMessage } from '../types';
import type { EndpointSettings } from './types';

function fitsWithinLimits(
  settings: EndpointSettings,
  messages: ChatMessage[]
): boolean {
  if (messages.length > settings.contextMaxMessages) {
    return false;
  }

  const usedCharacters = messages.reduce(
    (total, message) => total + estimateMessageCost(message),
    0
  );
  return usedCharacters <= settings.contextMaxCharacters;
}

export function composeConversation(
  settings: EndpointSettings,
  messages: ChatMessage[],
  compactedContext: CompactedContext | null = null
): ChatMessage[] {
  const liveMessages = (compactedContext
    ? messages.slice(compactedContext.sourceMessageCount)
    : messages).filter((message) => message.content.trim().length > 0);

  const prefix: ChatMessage[] = [];
  if (settings.systemPrompt) {
    prefix.push({ role: 'system', content: settings.systemPrompt });
  }
  if (compactedContext) {
    prefix.push({ role: 'system', content: compactedContext.summary });
  }

  for (let droppedCount = 0; droppedCount <= liveMessages.length; droppedCount += 1) {
    const droppedMessages = liveMessages.slice(0, droppedCount);
    const keptMessages = liveMessages.slice(droppedCount);
    const summaryMessages = droppedMessages.length > 0
      ? [{ role: 'system' as const, content: buildTruncationSummary(droppedMessages) }]
      : [];
    const composed = [...prefix, ...summaryMessages, ...keptMessages];

    if (fitsWithinLimits(settings, composed)) {
      return composed;
    }
  }

  return prefix;
}
