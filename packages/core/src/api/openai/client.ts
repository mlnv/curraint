import { debugLog } from '../../debug/log';
import type { ChatMessage, ChatResult } from '../../types';
import type { EndpointSettings } from '../../settings/types';
import {
  createAuthHeaders,
  logRequest,
  logResponse,
  readErrorDetail,
  validateSettingsForRequest
} from './request';
import { buildOpenAiPayload } from './payload';
import { readStreamingCompletion } from './streaming';
import type {
  AbortableRequestOptions,
  CompletionResponse,
  StreamCallbacks,
  StreamOptions,
} from './types';

export async function testConnection(settings: EndpointSettings): Promise<string> {
  const baseUrl = validateSettingsForRequest(settings);
  const url = `${baseUrl}/chat/completions`;
  const headers = createAuthHeaders(settings);
  const body = { model: settings.model.trim(), messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 };
  logRequest('(test connection)', url, headers, body);
  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  logResponse(response);
  if (!response.ok) throw new Error(`Connection test failed (${response.status}): ${await readErrorDetail(response)}`);
  return 'Connection successful.';
}

export async function chatCompletion(
  settings: EndpointSettings,
  messages: ChatMessage[],
  options: AbortableRequestOptions = {}
): Promise<ChatResult> {
  const baseUrl = validateSettingsForRequest(settings);
  const url = `${baseUrl}/chat/completions`;
  const headers = createAuthHeaders(settings);
  const body = buildOpenAiPayload(settings, messages);
  logRequest('', url, headers, body);
  const response = await fetch(url, {
    method: 'POST',
    headers,
    signal: options.signal,
    body: JSON.stringify(body)
  });
  logResponse(response);
  if (!response.ok) throw new Error(`Request failed (${response.status}): ${await readErrorDetail(response)}`);
  const json = (await response.json()) as CompletionResponse;
  debugLog('API', 'Response body', json);
  const message = json.choices?.[0]?.message?.content?.trim();
  if (!message) throw new Error('Endpoint returned an empty response.');
  return { message };
}

export async function chatCompletionStream(
  settings: EndpointSettings,
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  options: StreamOptions = {}
): Promise<ChatResult> {
  const baseUrl = validateSettingsForRequest(settings);
  const url = `${baseUrl}/chat/completions`;
  const headers = createAuthHeaders(settings);
  const body = buildOpenAiPayload(settings, messages, { stream: true });
  logRequest('(stream)', url, headers, body);
  const response = await fetch(url, { method: 'POST', headers, signal: options.signal, body: JSON.stringify(body) });
  logResponse(response);
  if (!response.ok) throw new Error(`Streaming request failed (${response.status}): ${await readErrorDetail(response)}`);
  const result = await readStreamingCompletion(response, callbacks);
  debugLog('API', 'Stream complete', { fullMessage: result.message, usage: result.usage });
  return { message: result.message, usage: result.usage };
}
