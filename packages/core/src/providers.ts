import type { ProviderId } from './types';

export type ProviderConfig = {
  id: ProviderId;
  label: string;
  defaultBaseUrl: string;
  defaultModel: string;
  requiresApiKey: boolean;
  requiresBaseUrl: boolean;
};

export const PROVIDER_CONFIGS: Record<ProviderId, ProviderConfig> = {
  openai: {
    id: 'openai',
    label: 'OpenAI (Cloud)',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    requiresApiKey: true,
    requiresBaseUrl: true
  },
  lmstudio: {
    id: 'lmstudio',
    label: 'LM Studio (Local)',
    defaultBaseUrl: 'http://127.0.0.1:1234/v1',
    defaultModel: 'local-model',
    requiresApiKey: false,
    requiresBaseUrl: true
  },
  custom: {
    id: 'custom',
    label: 'Custom OpenAI-Compatible',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    requiresApiKey: false,
    requiresBaseUrl: true
  },
  copilot: {
    id: 'copilot',
    label: 'GitHub Copilot',
    defaultBaseUrl: '',
    defaultModel: 'gpt-4o',
    requiresApiKey: false,
    requiresBaseUrl: false
  }
};

export const PROVIDER_OPTIONS: ProviderConfig[] = [
  PROVIDER_CONFIGS.openai,
  PROVIDER_CONFIGS.lmstudio,
  PROVIDER_CONFIGS.custom,
  PROVIDER_CONFIGS.copilot
];

export function isProviderId(value: string): value is ProviderId {
  return value === 'openai' || value === 'lmstudio' || value === 'custom' || value === 'copilot';
}

export function getProviderConfig(provider: ProviderId): ProviderConfig {
  return PROVIDER_CONFIGS[provider];
}

export function requiresApiKeyForProvider(provider: ProviderId): boolean {
  return PROVIDER_CONFIGS[provider].requiresApiKey;
}
