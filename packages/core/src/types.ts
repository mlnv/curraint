export type ProviderId = 'openai' | 'lmstudio' | 'custom' | 'copilot';

export type TokenUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens: number;
};

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: number;
  durationMs?: number;
  usage?: TokenUsage;
};

export type ChatResult = {
  message: string;
  usage?: TokenUsage;
};
