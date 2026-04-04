import { requestUrl, Platform } from 'obsidian';
import {
  chatCompletionStream,
  composeConversation,
} from '@curraint/core';
import type { EndpointSettings, ChatSessionTransport } from '@curraint/core';
import type { ChatMessage, TokenUsage } from '@curraint/core';
import type CurraintPlugin from './main';

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

// --- LM Studio native API (/api/v1/chat) ------------------------------------

type LmsOutput = { type: string; content?: string };
type LmsResponse = {
  output?: LmsOutput[];
  response_id?: string;
  error?: { message?: string };
};

export function buildLmsUrl(baseUrl: string): string {
  // Strip trailing slash and any /v1 suffix left over from the old default URL.
  const base = baseUrl.trim().replace(/\/v1\/?$/, '').replace(/\/$/, '');
  return `${base}/api/v1/chat`;
}

// Sends a message to LM Studio using its native stateful chat API.
// Uses Obsidian's requestUrl to bypass CORS preflight restrictions - native
// fetch triggers an OPTIONS preflight that LM Studio rejects. requestUrl
// routes through Electron's main process and is not subject to CORS.
// Passes previous_response_id so the server maintains conversation history.
async function lmStudioChat(
  settings: EndpointSettings,
  lastUserMessage: string,
  previousResponseId: string | null
): Promise<{ text: string; responseId: string | null }> {
  const url = buildLmsUrl(settings.baseUrl);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (settings.apiKey.trim()) headers['Authorization'] = `Bearer ${settings.apiKey.trim()}`;

  const body: Record<string, unknown> = { model: settings.model.trim(), input: lastUserMessage };
  if (settings.systemPrompt) body.system_prompt = settings.systemPrompt;
  if (previousResponseId) body.previous_response_id = previousResponseId;

  const res = await requestUrl({ url, method: 'POST', headers, body: JSON.stringify(body), throw: false });
  if (res.status < 200 || res.status >= 300) {
    const json = res.json as LmsResponse | undefined;
    throw new Error(`LM Studio request failed (${res.status}): ${json?.error?.message ?? res.text}`);
  }

  const json = res.json as LmsResponse;
  const text = json.output?.find((o) => o.type === 'message')?.content?.trim();
  if (!text) throw new Error('LM Studio returned an empty response.');
  return { text, responseId: json.response_id ?? null };
}

// --- OpenAI-compatible fallback (for openai / custom providers) -------------

export function buildCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/$/, '');
  const base = trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
  return `${base}/chat/completions`;
}

// Uses Obsidian's requestUrl to bypass the Chromium CORS preflight that native
// fetch triggers for cross-origin requests to local servers.
async function corsFreeChatCompletion(
  settings: EndpointSettings,
  messages: { role: string; content: string }[]
): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (settings.apiKey.trim()) headers['Authorization'] = `Bearer ${settings.apiKey.trim()}`;
  const res = await requestUrl({
    url: buildCompletionsUrl(settings.baseUrl),
    method: 'POST',
    headers,
    body: JSON.stringify({ model: settings.model.trim(), messages }),
    throw: false,
  });
  if (res.status < 200 || res.status >= 300) {
    const detail =
      (res.json as { error?: { message?: string } } | undefined)?.error?.message ?? res.text;
    throw new Error(`Request failed (${res.status}): ${detail}`);
  }
  const text = (res.json as { choices?: { message?: { content?: string } }[] } | undefined)
    ?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Endpoint returned an empty response.');
  return text;
}

// --- LM Studio connection test ---------------------------------------------

export async function testLmStudioConnection(settings: EndpointSettings): Promise<string> {
  const url = buildLmsUrl(settings.baseUrl);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (settings.apiKey.trim()) headers['Authorization'] = `Bearer ${settings.apiKey.trim()}`;
  const body = { model: settings.model.trim(), input: 'ping' };
  const res = await requestUrl({ url, method: 'POST', headers, body: JSON.stringify(body), throw: false });
  if (res.status < 200 || res.status >= 300) {
    const json = res.json as LmsResponse | undefined;
    throw new Error(`Connection test failed (${res.status}): ${json?.error?.message ?? res.text}`);
  }
  return 'Connection successful.';
}

// --- LM Studio system prompt merge ------------------------------------------

// Merges any conversation-level system messages (e.g. note context injected
// per-turn) with the static system prompt from settings, returning a settings
// object with the combined prompt. Returns the original settings unchanged
// when no merge is needed.
export function resolveEffectiveLmsSettings(
  settings: EndpointSettings,
  messages: { role: string; content: string }[]
): EndpointSettings {
  const conversationSystemParts = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content);
  if (conversationSystemParts.length === 0) return settings;
  const effectiveSystemPrompt =
    [settings.systemPrompt, ...conversationSystemParts].filter(Boolean).join('\n\n') || undefined;
  return effectiveSystemPrompt === settings.systemPrompt
    ? settings
    : { ...settings, systemPrompt: effectiveSystemPrompt ?? '' };
}

// --- LM Studio stream --------------------------------------------------------

// Sends a single turn to LM Studio using its native stateful API and calls
// onDelta with the full response text. Returns the updated response ID so the
// caller can thread subsequent turns through the server-side conversation.
async function streamLmStudio(
  settings: EndpointSettings,
  messages: { role: string; content: string }[],
  onDelta: (delta: string) => void,
  lmsResponseId: string | null,
  signal?: AbortSignal
): Promise<{ text: string; responseId: string | null }> {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUser) throw new Error('No user message to send.');

  const lmsSettings = resolveEffectiveLmsSettings(settings, messages);
  const { text, responseId } = await lmStudioChat(lmsSettings, lastUser.content, lmsResponseId);

  // requestUrl cannot be aborted - check if Stop was pressed while waiting
  // and surface it as an AbortError so the core handles it as a cancellation.
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  onDelta(text);
  return { text, responseId };
}

// --- OpenAI-compatible stream ------------------------------------------------

// Streams a chat completion using the OpenAI-compatible API. Falls back to a
// single non-streaming requestUrl call if SSE streaming fails before any
// chunks arrive (e.g. providers that do not support streaming in all configs).
async function streamOpenAiCompat(
  settings: EndpointSettings,
  messages: ChatMessage[],
  onDelta: (delta: string) => void,
  signal?: AbortSignal
): Promise<{ text: string; usage?: TokenUsage }> {
  const composed = composeConversation(settings, messages);
  const apiMessages = composed.map(({ role, content }) => ({ role, content }));
  let hasStreamedChunk = false;
  let streamedMessage = '';

  try {
    const result = await chatCompletionStream(
      settings,
      composed,
      {
        onDelta: (delta) => {
          hasStreamedChunk = true;
          streamedMessage += delta;
          onDelta(delta);
        },
      },
      { signal }
    );
    return { text: result.message, usage: result.usage };
  } catch (error) {
    if (isAbortError(error)) return { text: streamedMessage };
    if (hasStreamedChunk) throw error;

    if (signal?.aborted) return { text: streamedMessage };

    const text = await corsFreeChatCompletion(settings, apiMessages);

    if (signal?.aborted) return { text: streamedMessage };

    onDelta(text);
    return { text };
  }
}

// --- Transport factory -------------------------------------------------------

export function buildTransport(plugin: CurraintPlugin): ChatSessionTransport {
  // Tracks the LM Studio server-side conversation so the full history does not
  // need to be re-sent on every turn. Reset when the session is cleared.
  let lmsResponseId: string | null = null;

  // Cache the last-decrypted API key so PBKDF2 and AES-GCM do not run on
  // every message send. Invalidated automatically when the encrypted value
  // changes (i.e. when the user updates their key in settings).
  let cachedEncrypted: string | null = null;
  let cachedApiKey = '';

  async function resolveSettings(): Promise<EndpointSettings> {
    const s = plugin.settings;
    if (s.apiKeyEncrypted !== cachedEncrypted) {
      cachedApiKey = s.apiKeyEncrypted ? await plugin.secrets.decrypt(s.apiKeyEncrypted) : '';
      cachedEncrypted = s.apiKeyEncrypted;
    }
    return {
      provider: s.provider,
      apiKey: cachedApiKey,
      baseUrl: s.baseUrl,
      model: s.model,
      systemPrompt: s.systemPrompt,
      contextMaxMessages: s.contextMaxMessages,
      contextMaxCharacters: s.contextMaxCharacters,
      enableSessionSaving: s.enableSessionSaving,
    };
  }

  return {
    streamChat: async (messages, onDelta, options) => {
      const settings = await resolveSettings();

      // LM Studio requires a local server - it is not reachable on mobile.
      if (settings.provider === 'lmstudio' && Platform.isMobile) {
        throw new Error(
          'LM Studio is not available on mobile. Switch to a cloud provider in Settings.'
        );
      }

      // LM Studio native API - stateful, no full-history re-send.
      // Only use the native API when server-side context exists (lmsResponseId
      // set) or this is the very first message of a fresh conversation.
      // For sessions loaded from disk, lmsResponseId is null but prior history
      // exists - fall through to OpenAI-compatible path to send full history.
      const nonSystemMessages = messages.filter((m) => m.role !== 'system');
      if (settings.provider === 'lmstudio' && (lmsResponseId !== null || nonSystemMessages.length <= 1)) {
        const { text, responseId } = await streamLmStudio(
          settings, messages, onDelta, lmsResponseId, options?.signal
        );
        lmsResponseId = responseId;
        return { text };
      }

      return streamOpenAiCompat(settings, messages, onDelta, options?.signal);
    },

    clearSession: async () => {
      lmsResponseId = null;
    },
  };
}
