import { CONTEXT_SAFETY_LIMIT_BOUNDS, normalizeContextLimit } from '../context';
import { isProviderId } from '../providers/utils';
import { PROVIDER_CONFIGS } from '../providers/configs';
import { DEFAULT_SETTINGS } from './defaults';
import type { EndpointSettings, Profile } from './types';

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

export function normalizeProfile(
  input: Partial<Profile> & { id: string; name: string; provider: Profile['provider'] }
): Profile {
  return {
    id: input.id,
    name: input.name,
    provider: input.provider,
    baseUrl: input.baseUrl?.trim() || undefined,
    model: input.model?.trim() || undefined,
    systemPrompt: input.systemPrompt?.trim() || undefined,
    contextMaxMessages: typeof input.contextMaxMessages === 'number' ? input.contextMaxMessages : undefined,
    contextMaxCharacters: typeof input.contextMaxCharacters === 'number' ? input.contextMaxCharacters : undefined,
    enableSessionSaving: typeof input.enableSessionSaving === 'boolean' ? input.enableSessionSaving : undefined,
  };
}

export function resolveProfile(profile: Profile, apiKey: string): EndpointSettings {
  const config = PROVIDER_CONFIGS[profile.provider];
  return normalizeSettings({
    provider: profile.provider,
    apiKey,
    baseUrl: profile.baseUrl ?? config.defaultBaseUrl,
    model: profile.model ?? config.defaultModel,
    systemPrompt: profile.systemPrompt ?? DEFAULT_SETTINGS.systemPrompt,
    contextMaxMessages: profile.contextMaxMessages ?? DEFAULT_SETTINGS.contextMaxMessages,
    contextMaxCharacters: profile.contextMaxCharacters ?? DEFAULT_SETTINGS.contextMaxCharacters,
    enableSessionSaving: profile.enableSessionSaving ?? DEFAULT_SETTINGS.enableSessionSaving,
  });
}
