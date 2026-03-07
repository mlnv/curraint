import type { ProviderId } from '../types';

export type EndpointSettings = {
  provider: ProviderId;
  apiKey: string;
  baseUrl: string;
  model: string;
  systemPrompt: string;
  contextMaxMessages: number;
  contextMaxCharacters: number;
};
