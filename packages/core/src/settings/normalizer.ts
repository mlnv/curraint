import { CONTEXT_SAFETY_LIMIT_BOUNDS, normalizeContextLimit } from '../context';
import { isProviderId } from '../providers/utils';
import { DEFAULT_SETTINGS } from './defaults';
import type { EndpointSettings } from './types';

export function normalizeSettings(
  input: Partial<EndpointSettings> | EndpointSettings
): EndpointSettings {
  const providerCandidate = input.provider ?? DEFAULT_SETTINGS.provider;
  const provider = isProviderId(providerCandidate) ? providerCandidate : DEFAULT_SETTINGS.provider;

  return {
    provider,
    apiKey: (input.apiKey ?? DEFAULT_SETTINGS.apiKey).trim(),
    baseUrl: (input.baseUrl ?? DEFAULT_SETTINGS.baseUrl).trim(),
    model: (input.model ?? DEFAULT_SETTINGS.model).trim(),
    systemPrompt: (input.systemPrompt ?? DEFAULT_SETTINGS.systemPrompt).trim(),
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
    ),
    enableSessionSaving:
      typeof input.enableSessionSaving === 'boolean'
        ? input.enableSessionSaving
        : DEFAULT_SETTINGS.enableSessionSaving
  };
}
