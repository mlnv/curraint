export type ProviderId = 'openai' | 'lmstudio' | 'custom' | 'copilot';

/**
 * Core connection and session settings shared across all runtimes (CLI,
 * Desktop, …).  Desktop-specific UI preferences (theme, shortcuts, saved
 * connections) live in `AppSettings` inside the desktop package.
 */
export type EndpointSettings = {
  provider: ProviderId;
  apiKey: string;
  baseUrl: string;
  model: string;
  systemPrompt: string;
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
