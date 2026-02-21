import { DEFAULT_SETTINGS } from './defaults';
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
      input.enableThinkTagFolding ?? DEFAULT_SETTINGS.enableThinkTagFolding
  };
}

export function composeConversation(
  settings: EndpointSettings,
  messages: ChatMessage[]
): ChatMessage[] {
  if (!settings.systemPrompt) {
    return messages;
  }

  return [{ role: 'system', content: settings.systemPrompt }, ...messages];
}
