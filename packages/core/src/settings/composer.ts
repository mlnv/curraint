import { truncateConversationForContext } from '../context/truncator';
import type { CompactedContext } from '../context/types';
import type { ChatMessage } from '../types';
import type { EndpointSettings } from './types';

export function composeConversation(
  settings: EndpointSettings,
  messages: ChatMessage[],
  compactedContext: CompactedContext | null = null
): ChatMessage[] {
  const liveMessages = compactedContext
    ? messages.slice(compactedContext.sourceMessageCount)
    : messages;
  const { keptMessages, summary } = truncateConversationForContext(liveMessages, {
    maxMessages: settings.contextMaxMessages,
    maxCharacters: settings.contextMaxCharacters
  });

  const composed: ChatMessage[] = [];
  if (settings.systemPrompt) composed.push({ role: 'system', content: settings.systemPrompt });
  if (compactedContext) composed.push({ role: 'system', content: compactedContext.summary });
  if (summary) composed.push({ role: 'system', content: summary });
  composed.push(...keptMessages);
  return composed;
}
