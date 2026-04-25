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
  tone: 'danger' | 'warn' | 'safe';
  hasCompactedContext: boolean;
  compactedMessages: number;
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value));
}

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
  const messagePercent = settings.contextMaxMessages > 0
    ? clampPercent(Math.round((usedMessages / settings.contextMaxMessages) * 100))
    : 0;
  const characterPercent = settings.contextMaxCharacters > 0
    ? clampPercent(Math.round((usedCharacters / settings.contextMaxCharacters) * 100))
    : 0;
  const percent = Math.max(messagePercent, characterPercent);

  return {
    usedMessages,
    maxMessages: settings.contextMaxMessages,
    usedCharacters,
    maxCharacters: settings.contextMaxCharacters,
    messagePercent,
    characterPercent,
    percent,
    tone: percent >= 90 ? 'danger' : percent >= 70 ? 'warn' : 'safe',
    hasCompactedContext: compactedContext !== null,
    compactedMessages: compactedContext?.sourceMessageCount ?? 0
  };
}