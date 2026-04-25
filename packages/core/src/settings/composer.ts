import { buildTruncationSummary, estimateMessageCost } from '../context';
import type { CompactedContext } from '../context/types';
import type { ChatMessage } from '../types';
import type { EndpointSettings } from './types';

function fitsWithinLimits(
  settings: EndpointSettings,
  usedMessages: number,
  usedCharacters: number,
): boolean {
  if (usedMessages > settings.contextMaxMessages) {
    return false;
  }

  return usedCharacters <= settings.contextMaxCharacters;
}

function buildSystemPrefixContent(
  settings: EndpointSettings,
  compactedSummary: string | null,
  truncationSummary: string | null = null,
): string {
  return [settings.systemPrompt, compactedSummary, truncationSummary]
    .filter((part): part is string => Boolean(part && part.trim().length > 0))
    .join('\n\n');
}

function clampSourceMessageCount(
  messages: ChatMessage[],
  compactedContext: CompactedContext,
): number {
  const clampedCount = Math.min(
    Math.max(compactedContext.sourceMessageCount, 0),
    messages.length,
  );

  if (clampedCount !== compactedContext.sourceMessageCount) {
    console.warn(
      `[context] Clamped stale compacted-context boundary from ${compactedContext.sourceMessageCount} to ${clampedCount}.`,
    );
  }

  return clampedCount;
}

export function composeConversation(
  settings: EndpointSettings,
  messages: ChatMessage[],
  compactedContext: CompactedContext | null = null
): ChatMessage[] {
  const sourceMessageCount = compactedContext
    ? clampSourceMessageCount(messages, compactedContext)
    : 0;
  const liveMessages = compactedContext
    ? messages.slice(sourceMessageCount)
    : messages;
  const baseSystemContent = buildSystemPrefixContent(
    settings,
    compactedContext?.summary ?? null,
  );
  const prefix = baseSystemContent
    ? [{ role: 'system' as const, content: baseSystemContent }]
    : [];
  const prefixCharacters = prefix.length > 0
    ? estimateMessageCost(prefix[0])
    : 0;
  let keptCharacters = liveMessages.reduce(
    (total, message) => total + estimateMessageCost(message),
    0,
  );

  if (fitsWithinLimits(settings, prefix.length + liveMessages.length, prefixCharacters + keptCharacters)) {
    return [...prefix, ...liveMessages];
  }

  const summaryWindow: ChatMessage[] = [];

  for (let droppedCount = 1; droppedCount <= liveMessages.length; droppedCount += 1) {
    const droppedMessage = liveMessages[droppedCount - 1]!;
    keptCharacters -= estimateMessageCost(droppedMessage);
    summaryWindow.push(droppedMessage);
    if (summaryWindow.length > 8) {
      summaryWindow.shift();
    }

    const truncationSummary = buildTruncationSummary(summaryWindow);
    const systemContent = buildSystemPrefixContent(
      settings,
      compactedContext?.summary ?? null,
      truncationSummary,
    );
    const prefixWithSummary = systemContent
      ? [{ role: 'system' as const, content: systemContent }]
      : [];
    const usedMessages = prefixWithSummary.length + liveMessages.length - droppedCount;
    const usedCharacters = keptCharacters + (
      prefixWithSummary.length > 0 ? estimateMessageCost(prefixWithSummary[0]) : 0
    );

    if (fitsWithinLimits(settings, usedMessages, usedCharacters)) {
      return [...prefixWithSummary, ...liveMessages.slice(droppedCount)];
    }
  }

  if (!fitsWithinLimits(settings, prefix.length, prefixCharacters)) {
    const messagePercent = settings.contextMaxMessages > 0
      ? Math.round((prefix.length / settings.contextMaxMessages) * 100)
      : 0;
    const characterPercent = settings.contextMaxCharacters > 0
      ? Math.round((prefixCharacters / settings.contextMaxCharacters) * 100)
      : 0;
    const percent = Math.max(messagePercent, characterPercent);
    throw new Error(
      `Context overflow: system prompt and summarized context consume ${percent}% of the request budget.`,
    );
  }

  return prefix;
}
