import {
  loadSettingsFromFile,
  normalizeSettings,
  isProviderId,
} from '@curraint/core';
import type { EndpointSettings } from '@curraint/core';

/**
 * Loads settings from the shared settings file, then overlays any CURRAINT_*
 * environment variables on top so env vars always take precedence.
 */
export function loadSettings(): EndpointSettings {
  const file = loadSettingsFromFile();
  const providerCandidate = process.env['CURRAINT_PROVIDER'];

  return normalizeSettings({
    ...file,
    ...(providerCandidate && isProviderId(providerCandidate) ? { provider: providerCandidate } : {}),
    ...(process.env['CURRAINT_API_KEY'] !== undefined ? { apiKey: process.env['CURRAINT_API_KEY'] } : {}),
    ...(process.env['CURRAINT_BASE_URL'] !== undefined ? { baseUrl: process.env['CURRAINT_BASE_URL'] } : {}),
    ...(process.env['CURRAINT_MODEL'] !== undefined ? { model: process.env['CURRAINT_MODEL'] } : {}),
    ...(process.env['CURRAINT_SYSTEM_PROMPT'] !== undefined ? { systemPrompt: process.env['CURRAINT_SYSTEM_PROMPT'] } : {}),
  });
}
