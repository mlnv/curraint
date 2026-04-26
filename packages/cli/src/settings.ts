import {
  loadSettingsFromFile,
  normalizeSettings,
  isProviderId,
} from '@curraint/core';
import type { EndpointSettings } from '@curraint/core';

function readIntegerEnv(name: string): number | undefined {
  const value = process.env[name]?.trim();
  if (!value) {
    return undefined;
  }

  if (!/^-?\d+$/.test(value)) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

export function applyCliEnvironmentOverrides(settings: EndpointSettings): EndpointSettings {
  const providerCandidate = process.env['CURRAINT_PROVIDER'];
  const contextMaxMessages = readIntegerEnv('CURRAINT_CONTEXT_MAX_MESSAGES');
  const contextMaxCharacters = readIntegerEnv('CURRAINT_CONTEXT_MAX_CHARACTERS');

  return normalizeSettings({
    ...settings,
    ...(providerCandidate && isProviderId(providerCandidate) ? { provider: providerCandidate } : {}),
    ...(process.env['CURRAINT_API_KEY'] !== undefined ? { apiKey: process.env['CURRAINT_API_KEY'] } : {}),
    ...(process.env['CURRAINT_BASE_URL'] !== undefined ? { baseUrl: process.env['CURRAINT_BASE_URL'] } : {}),
    ...(process.env['CURRAINT_MODEL'] !== undefined ? { model: process.env['CURRAINT_MODEL'] } : {}),
    ...(process.env['CURRAINT_SYSTEM_PROMPT'] !== undefined ? { systemPrompt: process.env['CURRAINT_SYSTEM_PROMPT'] } : {}),
    ...(contextMaxMessages !== undefined ? { contextMaxMessages } : {}),
    ...(contextMaxCharacters !== undefined ? { contextMaxCharacters } : {}),
  });
}

/**
 * Loads settings from the shared settings file, then overlays any CURRAINT_*
 * environment variables on top so env vars always take precedence.
 */
export function loadSettings(): EndpointSettings {
  return applyCliEnvironmentOverrides(loadSettingsFromFile());
}
