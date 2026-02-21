export type ProviderId = 'openai' | 'lmstudio' | 'custom';

export type EndpointSettings = {
  provider: ProviderId;
  apiKey: string;
  baseUrl: string;
  model: string;
  systemPrompt: string;
  enableThinkTagFolding: boolean;
  contextMaxMessages: number;
  contextMaxCharacters: number;
};

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type ChatResult = {
  message: string;
};
