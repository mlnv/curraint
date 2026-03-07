import type { ProviderId } from '../types';
import { PROVIDER_CONFIGS } from './configs';
import type { ProviderConfig } from './types';
import { ENABLE_COPILOT_PROVIDER } from '../features';

export function isProviderId(value: string): value is ProviderId {
  if (value === 'openai' || value === 'lmstudio' || value === 'custom') return true;
  if (ENABLE_COPILOT_PROVIDER && value === 'copilot') return true;
  return false;
}

export function getProviderConfig(provider: ProviderId): ProviderConfig {
  return PROVIDER_CONFIGS[provider];
}

export function requiresApiKeyForProvider(provider: ProviderId): boolean {
  return PROVIDER_CONFIGS[provider].requiresApiKey;
}
