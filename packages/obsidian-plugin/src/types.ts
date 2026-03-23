import type { ProviderId } from '@curraint/core';

export type PluginSettings = {
  provider: ProviderId;
  apiKeyEncrypted: string;
  baseUrl: string;
  model: string;
  systemPrompt: string;
  contextMaxMessages: number;
  contextMaxCharacters: number;
  enableSessionSaving: boolean;
};
