import type { EndpointSettings } from '@curraint/core';

export type ThemeId = 'black' | 'white' | 'dark' | 'monokai' | 'retro-sand' | 'retro-green';

/**
 * Full application settings — extends the core connection settings with
 * desktop-specific UI preferences.
 */
export type AppSettings = EndpointSettings & {
  theme: ThemeId;
  quickInputShortcut: string;
  enableThinkTagFolding: boolean;
  enableDebugLogging: boolean;
};
