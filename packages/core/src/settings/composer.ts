import { truncateConversationForContext } from '../context/truncator';
import type { ChatMessage } from '../types';
import type { EndpointSettings } from './types';

export function composeConversation(
  settings: EndpointSettings,
  messages: ChatMessage[]
): ChatMessage[] {
  const { keptMessages, summary } = truncateConversationForContext(messages, {
    maxMessages: settings.contextMaxMessages,
    maxCharacters: settings.contextMaxCharacters
  });

  const composed: ChatMessage[] = [];
  if (settings.systemPrompt) composed.push({ role: 'system', content: settings.systemPrompt });
  if (summary) composed.push({ role: 'system', content: summary });
  composed.push(...keptMessages);
  return composed;
}
