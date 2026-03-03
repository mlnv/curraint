import type { EndpointSettings } from './types';

export const DEFAULT_SETTINGS: EndpointSettings = {
  provider: 'openai',
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  systemPrompt: 'You are a helpful assistant.',
  enableThinkTagFolding: true,
  contextMaxMessages: 40,
  contextMaxCharacters: 24000,
  savedConnections: [],
  quickInputShortcut: 'CommandOrControl+Shift+A',
  theme: 'black'
};
