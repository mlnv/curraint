import { requestUrl } from 'obsidian';
import {
  chatCompletionStream,
  composeConversation,
} from '@curraint/core';
import type { EndpointSettings, ChatSessionTransport } from '@curraint/core';
import type CurraintPlugin from './main';
import { decryptApiKey } from './secrets';

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

function buildLmsUrl(baseUrl: string): string {
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

function buildCompletionsUrl(baseUrl: string): string {
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

// --- Transport factory -------------------------------------------------------

export function buildTransport(plugin: CurraintPlugin): ChatSessionTransport {
  // Tracks the LM Studio server-side conversation so the full history does not
  // need to be re-sent on every turn. Reset when the session is cleared.
  let lmsResponseId: string | null = null;

  return {
    streamChat: async (messages, onDelta, options) => {
      const settings = resolveSettings(plugin);

      // LM Studio native API - stateful, streaming over SSE.
      // Only use the native API when server-side context exists (lmsResponseId set)
      // or this is the very first message of a fresh conversation (no prior history).
      // For sessions loaded from disk, lmsResponseId is null but there IS prior
      // history - fall through to the OpenAI-compatible path below, which sends
      // the full message history so the model has correct context.
      const nonSystemMessages = messages.filter((m) => m.role !== 'system');
      if (settings.provider === 'lmstudio' && (lmsResponseId !== null || nonSystemMessages.length <= 1)) {
        const lastUser = [...messages].reverse().find((m) => m.role === 'user');
        if (!lastUser) throw new Error('No user message to send.');

        // Merge any conversation-level system messages (e.g. note context)
        // with the static system prompt from settings.
        const conversationSystemParts = messages
          .filter((m) => m.role === 'system')
          .map((m) => m.content);
        const effectiveSystemPrompt = [settings.systemPrompt, ...conversationSystemParts]
          .filter(Boolean)
          .join('\n\n') || undefined;

        const lmsSettings = effectiveSystemPrompt !== settings.systemPrompt
          ? { ...settings, systemPrompt: effectiveSystemPrompt ?? '' }
          : settings;

        const { text, responseId } = await lmStudioChat(lmsSettings, lastUser.content, lmsResponseId);

        // requestUrl cannot be aborted - check if Stop was pressed while waiting
        // and surface it as an AbortError so the core handles it as a cancellation.
        if (options?.signal?.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }

        lmsResponseId = responseId;
        onDelta(text);
        return { text };
      }

      // OpenAI-compatible providers.
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
          { signal: options?.signal }
        );
        return { text: result.message, usage: result.usage };
      } catch (error) {
        if (isAbortError(error)) return { text: streamedMessage };
        if (hasStreamedChunk) throw error;
        const text = await corsFreeChatCompletion(settings, apiMessages);
        onDelta(text);
        return { text };
      }
    },

    clearSession: async () => {
      lmsResponseId = null;
    },
  };
}

function resolveSettings(plugin: CurraintPlugin): EndpointSettings {
  const s = plugin.settings;
  return {
    provider: s.provider,
    apiKey: s.apiKeyEncrypted ? decryptApiKey(s.apiKeyEncrypted) : '',
    baseUrl: s.baseUrl,
    model: s.model,
    systemPrompt: s.systemPrompt,
    contextMaxMessages: s.contextMaxMessages,
    contextMaxCharacters: s.contextMaxCharacters,
    enableSessionSaving: s.enableSessionSaving,
  };
}
