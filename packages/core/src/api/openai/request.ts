import { debugLog } from '../../debug/log';
import { requiresApiKeyForProvider } from '../../providers/utils';
import type { EndpointSettings } from '../../settings/types';

export function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/$/, '');
  if (!trimmed) throw new Error('API base URL is missing. Please set it in Settings.');
  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
}

export function createAuthHeaders(settings: EndpointSettings): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (settings.apiKey.trim()) headers.Authorization = `Bearer ${settings.apiKey.trim()}`;
  return headers;
}

export function debugHeaders(headers: Record<string, string>): Record<string, string> {
  if (!headers.Authorization) return headers;
  const key = headers.Authorization.replace(/^Bearer\s+/, '');
  const masked = key.length > 4 ? `Bearer ***...${key.slice(-4)}` : 'Bearer ***';
  return { ...headers, Authorization: masked };
}

export async function readErrorDetail(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } };
    return parsed.error?.message ?? text;
  } catch {
    return text;
  }
}

export function validateSettingsForRequest(settings: EndpointSettings): string {
  if (requiresApiKeyForProvider(settings.provider) && !settings.apiKey.trim()) {
    throw new Error('API key is missing. Please set it in Settings.');
  }
  if (!settings.model.trim()) throw new Error('Model is missing. Please set it in Settings.');
  return normalizeBaseUrl(settings.baseUrl);
}

export function logRequest(
  label: string,
  url: string,
  headers: Record<string, string>,
  body: unknown
): void {
  debugLog('API', `POST ${url}${label ? ' ' + label : ''}`, { headers: debugHeaders(headers), body });
}

export function logResponse(response: Response): void {
  debugLog('API', `Response ${response.status} ${response.statusText}`);
}
