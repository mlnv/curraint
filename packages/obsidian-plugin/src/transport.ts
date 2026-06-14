import { requestUrl, Platform } from 'obsidian';
import { buildPiTransport } from '@curraint/core';
import type { EndpointSettings, ChatSessionTransport } from '@curraint/core';
import type CurraintPlugin from './main';

type TransportPlugin = Pick<CurraintPlugin, 'settings' | 'secrets'>;

// --- LM Studio native API (/api/v1/chat) ------------------------------------

type LmsOutput = { type: string; content?: string };
type LmsResponse = {
  output?: LmsOutput[];
  response_id?: string;
  error?: { message?: string };
};

export function buildLmsUrl(baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/v1\/?$/, '').replace(/\/$/, '');
  return `${base}/api/v1/chat`;
}

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

  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  onDelta(text);
  return { text, responseId };
}

// --- Transport factory -------------------------------------------------------

export function buildTransport(plugin: TransportPlugin): ChatSessionTransport {
  let lmsResponseId: string | null = null;

  let cachedEncrypted: string | null = null;
  let cachedApiKey = '';

  async function resolveSettings(): Promise<EndpointSettings> {
    const s = plugin.settings;
    const profile = s.profiles[s.activeProfileId];
    if (!profile) {
      throw new Error(`Active profile "${s.activeProfileId}" not found in plugin settings.`);
    }
    const encryptedKey = profile.apiKeyEncrypted ?? '';
    if (encryptedKey !== cachedEncrypted) {
      cachedApiKey = encryptedKey ? await plugin.secrets.decrypt(encryptedKey) : '';
      cachedEncrypted = encryptedKey;
    }
    return {
      provider: profile.provider,
      apiKey: cachedApiKey,
      baseUrl: profile.baseUrl ?? '',
      model: profile.model ?? '',
      systemPrompt: profile.systemPrompt ?? 'You are a helpful assistant.',
      contextMaxMessages: profile.contextMaxMessages ?? 40,
      contextMaxCharacters: profile.contextMaxCharacters ?? 24000,
      enableSessionSaving: profile.enableSessionSaving ?? false,
    };
  }

  return {
    streamChat: async (messages, onDelta, options) => {
      const settings = await resolveSettings();

      if (settings.provider === 'lmstudio' && Platform.isMobile) {
        throw new Error(
          'LM Studio is not available on mobile. Switch to a cloud provider in Settings.'
        );
      }

      // LM Studio native API via requestUrl (bypasses CORS for local endpoints).
      // Only use when server-side context exists or this is a fresh conversation.
      const nonSystemMessages = messages.filter((m) => m.role !== 'system');
      if (settings.provider === 'lmstudio' && (lmsResponseId !== null || nonSystemMessages.length <= 1)) {
        const { text, responseId } = await streamLmStudio(
          settings, messages, onDelta, lmsResponseId, options?.signal
        );
        lmsResponseId = responseId;
        return { text };
      }

      const piTransport = buildPiTransport(settings);
      return piTransport.streamChat(messages, onDelta, options);
    },

    clearSession: async () => {
      lmsResponseId = null;
    },
  };
}
