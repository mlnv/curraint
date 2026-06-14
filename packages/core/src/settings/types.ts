import type { ProviderId } from '../types';

export type EndpointSettings = {
  provider: ProviderId;
  apiKey: string;
  baseUrl: string;
  model: string;
  systemPrompt: string;
  contextMaxMessages: number;
  contextMaxCharacters: number;
  enableSessionSaving: boolean;
};

export type Profile = {
  id: string;
  name: string;
  provider: ProviderId;
  baseUrl?: string;
  model?: string;
  systemPrompt?: string;
  contextMaxMessages?: number;
  contextMaxCharacters?: number;
  enableSessionSaving?: boolean;
};

export type SettingsFileV2 = {
  version: 2;
  activeProfileId: string;
  profiles: Record<string, Profile>;
};
