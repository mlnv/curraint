import { estimateMessageCost } from '../context';
import type { CompactedContext } from '../context';
import type { ChatMessage } from '../types';
import { composeConversation } from './composer';
import type { EndpointSettings } from './types';

export type ContextUsage = {
  usedMessages: number;
  maxMessages: number;
  usedCharacters: number;
  maxCharacters: number;
  messagePercent: number;
  characterPercent: number;
  percent: number;
  hasCompactedContext: boolean;
  compactedMessages: number;
};

export function getContextUsage(
  settings: EndpointSettings,
  messages: ChatMessage[],
  compactedContext: CompactedContext | null = null
): ContextUsage {
  const composed = composeConversation(settings, messages, compactedContext);
  const usedMessages = composed.length;
  const usedCharacters = composed.reduce(
    (total, message) => total + estimateMessageCost(message),
    0
  );
  const messagePercent = Math.round((usedMessages / settings.contextMaxMessages) * 100);
  const characterPercent = Math.round((usedCharacters / settings.contextMaxCharacters) * 100);

  return {
    usedMessages,
    maxMessages: settings.contextMaxMessages,
    usedCharacters,
    maxCharacters: settings.contextMaxCharacters,
    messagePercent,
    characterPercent,
    percent: Math.max(messagePercent, characterPercent),
    hasCompactedContext: compactedContext !== null,
    compactedMessages: compactedContext?.sourceMessageCount ?? 0
  };
}