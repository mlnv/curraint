import { PROVIDER_CONFIGS } from '@curraint/core';
import type { ProviderConfig, ProviderId, RuntimeFeatureFlags } from '@curraint/core';

const BASE_PROVIDER_OPTIONS: ProviderConfig[] = [
  PROVIDER_CONFIGS.openai,
  PROVIDER_CONFIGS.lmstudio,
  PROVIDER_CONFIGS.custom
];

export function getVisibleProviderOptions(
  selectedProvider: ProviderId,
  featureFlags: RuntimeFeatureFlags
): ProviderConfig[] {
  if (featureFlags.enableCopilotProvider || selectedProvider === 'copilot') {
    return [...BASE_PROVIDER_OPTIONS, PROVIDER_CONFIGS.copilot];
  }

  return BASE_PROVIDER_OPTIONS;
}