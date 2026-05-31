import type { Model, Api } from '@earendil-works/pi-ai';
import { getModel } from '@earendil-works/pi-ai';
import type { ProviderId } from '../types';
import type { EndpointSettings } from '../settings/types';
import { PROVIDER_CONFIGS } from '../providers/configs';

export interface ResolvedModel {
  model: Model<any>;
}

function createCustomModel(settings: EndpointSettings): Model<'openai-completions'> {
  const config = PROVIDER_CONFIGS[settings.provider];
  return {
    id: settings.model,
    name: settings.model,
    api: 'openai-completions',
    provider: 'openai',
    baseUrl: settings.baseUrl || config.defaultBaseUrl,
    reasoning: false,
    input: ['text'],
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0
    },
    contextWindow: 128000,
    maxTokens: 16384,
    compat: {
      supportsUsageInStreaming: true,
      maxTokensField: 'max_completion_tokens'
    }
  };
}

const PI_PROVIDER_MAP: Record<ProviderId, string> = {
  openai: 'openrouter',
  copilot: 'github-copilot',
  lmstudio: 'openai',
  custom: 'openai',
  deepseek: 'openai'
};

const PI_MODEL_MAP: Record<ProviderId, string> = {
  openai: 'openai/gpt-4o-mini',
  copilot: 'claude-haiku-4.5',
  lmstudio: 'local-model',
  custom: 'gpt-4o-mini',
  deepseek: 'deepseek-v4-flash'
};

export function resolvePiModel(settings: EndpointSettings): ResolvedModel {
  if (settings.provider === 'copilot') {
    const modelId = settings.model || PI_MODEL_MAP.copilot;
    const model = tryGetModel('github-copilot', modelId);
    return { model: model ?? createCustomModel(settings) };
  }

  if (settings.provider === 'openai') {
    const modelId = settings.model || PI_MODEL_MAP.openai;
    const model = tryGetModel('openrouter', modelId);
    return { model: model ?? createCustomModel(settings) };
  }

  if (settings.provider === 'deepseek') {
    const config = PROVIDER_CONFIGS.deepseek;
    const modelId = settings.model || config.defaultModel;
    return {
      model: {
        id: modelId,
        name: modelId,
        api: 'openai-completions',
        provider: 'openai',
        baseUrl: settings.baseUrl || config.defaultBaseUrl,
        reasoning: false,
        input: ['text'],
        cost: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0
        },
        contextWindow: 1000000,
        maxTokens: 384000,
        compat: {
          supportsUsageInStreaming: true,
          maxTokensField: 'max_completion_tokens'
        }
      }
    };
  }

  return { model: createCustomModel(settings) };
}

function tryGetModel<TProvider extends string>(provider: TProvider, modelId: string): Model<any> | undefined {
  try {
    return getModel(provider as any, modelId as any);
  } catch {
    return undefined;
  }
}

export function resolveApiKey(settings: EndpointSettings): string | undefined {
  if (settings.apiKey) return settings.apiKey;
  const config = PROVIDER_CONFIGS[settings.provider];
  if (config?.requiresApiKey) return undefined;
  if (settings.provider === 'copilot') return undefined;
  return 'not-needed';
}
