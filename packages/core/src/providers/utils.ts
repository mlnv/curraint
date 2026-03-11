import type { ProviderId } from '../types';
import { PROVIDER_CONFIGS, PROVIDER_OPTIONS } from './configs';
import type { ProviderConfig } from './types';

export function isProviderId(value: string): value is ProviderId {
  return PROVIDER_OPTIONS.some((p) => p.id === value);
}

export function getProviderConfig(provider: ProviderId): ProviderConfig {
  return PROVIDER_CONFIGS[provider];
}

export function requiresApiKeyForProvider(provider: ProviderId): boolean {
  return PROVIDER_CONFIGS[provider].requiresApiKey;
}
