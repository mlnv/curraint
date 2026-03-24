import type { ProviderId } from '@curraint/core';

declare const __DEV__: boolean;

export type PluginSettings = {
  provider: ProviderId;
  apiKeyEncrypted: string;
  baseUrl: string;
  model: string;
  systemPrompt: string;
  contextMaxMessages: number;
  contextMaxCharacters: number;
  enableSessionSaving: boolean;
  // Random 32-byte key (base64) generated on first mobile run.
  // Used by MobileSecretsStrategy to encrypt the API key with Web Crypto.
  // Empty on desktop - the DesktopSecretsStrategy uses a machine-derived key.
  mobileDeviceKey: string;
};
