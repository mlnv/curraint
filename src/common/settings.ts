import { DEFAULT_SETTINGS } from './defaults';
import type { ChatMessage, EndpointSettings } from './types';

export function normalizeSettings(
  input: Partial<EndpointSettings> | EndpointSettings
): EndpointSettings {
  return {
    apiKey: (input.apiKey ?? DEFAULT_SETTINGS.apiKey).trim(),
    baseUrl: (input.baseUrl ?? DEFAULT_SETTINGS.baseUrl).trim(),
    model: (input.model ?? DEFAULT_SETTINGS.model).trim(),
    systemPrompt: (input.systemPrompt ?? DEFAULT_SETTINGS.systemPrompt).trim()
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
