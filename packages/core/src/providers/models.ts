import type { ProviderId } from '../types';

export type ProviderModel = {
  id: string;
  label: string;
  contextWindow?: number;
};

export const PROVIDER_MODELS: Record<ProviderId, ProviderModel[]> = {
  openai: [
    { id: 'gpt-4o', label: 'GPT-4o', contextWindow: 128000 },
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini', contextWindow: 128000 },
    { id: 'gpt-4.1', label: 'GPT-4.1', contextWindow: 1000000 },
    { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', contextWindow: 1000000 },
    { id: 'gpt-4.1-nano', label: 'GPT-4.1 Nano', contextWindow: 1000000 },
    { id: 'o4-mini', label: 'o4 Mini', contextWindow: 200000 },
    { id: 'o3', label: 'o3', contextWindow: 200000 },
  ],
  deepseek: [
    { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash', contextWindow: 128000 },
    { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro', contextWindow: 128000 },
    { id: 'deepseek-chat', label: 'DeepSeek Chat (V3)', contextWindow: 64000 },
    { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner (R1)', contextWindow: 64000 },
  ],
  lmstudio: [
    { id: 'local-model', label: 'Local Model' },
  ],
  custom: [
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini (default)' },
  ],
  copilot: [
    { id: 'gpt-4o', label: 'GPT-4o', contextWindow: 128000 },
    { id: 'gpt-4.1', label: 'GPT-4.1', contextWindow: 1000000 },
    { id: 'claude-4.5-sonnet', label: 'Claude 4.5 Sonnet', contextWindow: 200000 },
    { id: 'claude-4-opus', label: 'Claude 4 Opus', contextWindow: 200000 },
    { id: 'claude-haiku-4.5', label: 'Claude Haiku 4.5', contextWindow: 200000 },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', contextWindow: 1000000 },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', contextWindow: 1000000 },
  ],
};

