import type { ProviderId } from '@curraint/core';

declare const __DEV__: boolean;

export type PluginProfile = {
  id: string;
  name: string;
  provider: ProviderId;
  apiKeyEncrypted: string;
  baseUrl?: string;
  model?: string;
  systemPrompt?: string;
  contextMaxMessages?: number;
  contextMaxCharacters?: number;
  enableSessionSaving?: boolean;
};

export type PluginSettings = {
  activeProfileId: string;
  profiles: Record<string, PluginProfile>;
  // Random 32-byte key (base64) generated on first mobile run.
  // Used by MobileSecretsStrategy to encrypt the API key with Web Crypto.
  // Empty on desktop - the DesktopSecretsStrategy uses a machine-derived key.
  mobileDeviceKey: string;
};
