import type { EndpointSettings, ProviderId } from '@curraint/core';

export type ThemeId = 'black' | 'white' | 'dark' | 'monokai' | 'retro-sand' | 'retro-green';

export type SavedConnection = {
  id: string;
  name: string;
  provider: ProviderId;
  apiKey: string;
  baseUrl: string;
  model: string;
};

/**
 * Full application settings — extends the core connection settings with
 * desktop-specific UI preferences (theme, shortcuts, saved connections).
 */
export type AppSettings = EndpointSettings & {
  theme: ThemeId;
  quickInputShortcut: string;
  savedConnections: SavedConnection[];
  enableThinkTagFolding: boolean;
};
