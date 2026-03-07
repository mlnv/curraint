import type { ProviderId } from '../types';

export type { ProviderId };

export type ProviderConfig = {
  id: ProviderId;
  label: string;
  defaultBaseUrl: string;
  defaultModel: string;
  requiresApiKey: boolean;
  requiresBaseUrl: boolean;
};
