import type { EndpointSettings, Profile } from './types';

export const DEFAULT_SETTINGS: EndpointSettings = {
  provider: 'openai',
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  systemPrompt: 'You are a helpful assistant.',
  contextMaxMessages: 40,
  contextMaxCharacters: 24000,
  enableSessionSaving: false
};

export const DEFAULT_PROFILE_ID = 'default';

export const DEFAULT_PROFILE: Profile = {
  id: DEFAULT_PROFILE_ID,
  name: 'Default',
  provider: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  systemPrompt: 'You are a helpful assistant.',
  contextMaxMessages: 40,
  contextMaxCharacters: 24000,
  enableSessionSaving: false,
};
