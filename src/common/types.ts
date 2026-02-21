export type EndpointSettings = {
  apiKey: string;
  baseUrl: string;
  model: string;
  systemPrompt: string;
};

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type ChatResult = {
  message: string;
};
