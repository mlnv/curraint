export type ProviderId = 'openai' | 'lmstudio' | 'custom' | 'copilot';

export type ThemeId = 'black' | 'white' | 'dark' | 'monokai' | 'retro-sand' | 'retro-green';

export type SavedConnection = {
  id: string;
  name: string;
  provider: ProviderId;
  apiKey: string;
  baseUrl: string;
  model: string;
};

export type EndpointSettings = {
  provider: ProviderId;
  apiKey: string;
  baseUrl: string;
  model: string;
  systemPrompt: string;
  enableThinkTagFolding: boolean;
  contextMaxMessages: number;
  contextMaxCharacters: number;
  savedConnections: SavedConnection[];
  quickInputShortcut: string;
  theme: ThemeId;
};

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type ChatResult = {
  message: string;
};
