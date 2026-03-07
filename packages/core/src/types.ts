export type ProviderId = 'openai' | 'lmstudio' | 'custom' | 'copilot';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type ChatResult = {
  message: string;
};
