import { DEFAULT_SETTINGS } from './defaults';
import {
  CONTEXT_SAFETY_LIMIT_BOUNDS,
  normalizeContextLimit,
  truncateConversationForContext
} from './contextSafety';
import { isProviderId } from './providers';
import type { ChatMessage, EndpointSettings } from './types';

export function normalizeSettings(
  input: Partial<EndpointSettings> | EndpointSettings
): EndpointSettings {
  const providerCandidate = input.provider ?? DEFAULT_SETTINGS.provider;
  const provider = isProviderId(providerCandidate)
    ? providerCandidate
    : DEFAULT_SETTINGS.provider;

  return {
    provider,
    apiKey: (input.apiKey ?? DEFAULT_SETTINGS.apiKey).trim(),
    baseUrl: (input.baseUrl ?? DEFAULT_SETTINGS.baseUrl).trim(),
    model: (input.model ?? DEFAULT_SETTINGS.model).trim(),
    systemPrompt: (input.systemPrompt ?? DEFAULT_SETTINGS.systemPrompt).trim(),
    enableThinkTagFolding:
      input.enableThinkTagFolding ?? DEFAULT_SETTINGS.enableThinkTagFolding,
    contextMaxMessages: normalizeContextLimit(
      input.contextMaxMessages,
      DEFAULT_SETTINGS.contextMaxMessages,
      CONTEXT_SAFETY_LIMIT_BOUNDS.minMessages,
      CONTEXT_SAFETY_LIMIT_BOUNDS.maxMessages
    ),
    contextMaxCharacters: normalizeContextLimit(
      input.contextMaxCharacters,
      DEFAULT_SETTINGS.contextMaxCharacters,
      CONTEXT_SAFETY_LIMIT_BOUNDS.minCharacters,
      CONTEXT_SAFETY_LIMIT_BOUNDS.maxCharacters
    )
  };
}

export function composeConversation(
  settings: EndpointSettings,
  messages: ChatMessage[]
): ChatMessage[] {
  const { keptMessages, summary } = truncateConversationForContext(messages, {
    maxMessages: settings.contextMaxMessages,
    maxCharacters: settings.contextMaxCharacters
  });
  const composed: ChatMessage[] = [];

  if (settings.systemPrompt) {
    composed.push({ role: 'system', content: settings.systemPrompt });
  }

  if (summary) {
    composed.push({ role: 'system', content: summary });
  }

  composed.push(...keptMessages);
  return composed;
}
