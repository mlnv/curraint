import type { ProviderId } from '../types';
import type { ProviderConfig } from './types';
import { ENABLE_COPILOT_PROVIDER } from '../features';

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
  ...(ENABLE_COPILOT_PROVIDER ? [PROVIDER_CONFIGS.copilot] : [])
];
