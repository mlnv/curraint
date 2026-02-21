import type { EndpointSettings } from './types';

export const DEFAULT_SETTINGS: EndpointSettings = {
  provider: 'openai',
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  systemPrompt: 'You are a helpful assistant.'
};
