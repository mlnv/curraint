import { requiresApiKeyForProvider } from './providers';
import type { ChatMessage, ChatResult, EndpointSettings } from './types';

type CompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
    delta?: {
      content?: string;
    };
    text?: string;
  }>;
  error?: {
    message?: string;
  };
};

type ErrorResponse = {
  error?: {
    message?: string;
  };
};

function normalizeBaseUrl(baseUrl: string): string {
  const candidate = baseUrl.trim();
  if (!candidate) {
    throw new Error('API base URL is missing. Please set it in Settings.');
  }

  const trimmed = candidate.replace(/\/$/, '');
  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
}

function createAuthHeaders(settings: EndpointSettings): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (settings.apiKey.trim()) {
    headers.Authorization = `Bearer ${settings.apiKey.trim()}`;
  }

  return headers;
}

async function readErrorDetail(response: Response): Promise<string> {
  const text = await response.text();

  try {
    const parsed = JSON.parse(text) as ErrorResponse;
    return parsed.error?.message ?? text;
  } catch {
    return text;
  }
}

type StreamCallbacks = {
  onDelta: (delta: string) => void;
};

type StreamOptions = {
  signal?: AbortSignal;
};

function extractDelta(json: CompletionResponse): string {
  return (
    json.choices?.[0]?.delta?.content ??
    json.choices?.[0]?.message?.content ??
    json.choices?.[0]?.text ??
    ''
  );
}

async function readStreamingCompletion(
  response: Response,
  callbacks: StreamCallbacks
): Promise<string> {
  if (!response.body) {
    throw new Error('Streaming response body is unavailable.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let message = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    let separatorIndex = buffer.indexOf('\n\n');
    while (separatorIndex >= 0) {
      const eventBlock = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);

      const lines = eventBlock
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith('data:'));

      for (const line of lines) {
        const raw = line.slice(5).trim();
        if (!raw) {
          continue;
        }

        if (raw === '[DONE]') {
          continue;
        }

        let parsed: CompletionResponse;
        try {
          parsed = JSON.parse(raw) as CompletionResponse;
        } catch {
          continue;
        }

        const delta = extractDelta(parsed);
        if (!delta) {
          continue;
        }

        message += delta;
        callbacks.onDelta(delta);
      }

      separatorIndex = buffer.indexOf('\n\n');
    }
  }

  const finalMessage = message.trim();
  if (!finalMessage) {
    throw new Error('Endpoint returned an empty streaming response.');
  }

  return finalMessage;
}

function validateSettingsForRequest(settings: EndpointSettings): string {
  if (requiresApiKeyForProvider(settings.provider) && !settings.apiKey.trim()) {
    throw new Error('API key is missing. Please set it in Settings.');
  }

  if (!settings.model.trim()) {
    throw new Error('Model is missing. Please set it in Settings.');
  }

  return normalizeBaseUrl(settings.baseUrl);
}

export async function testConnection(settings: EndpointSettings): Promise<string> {
  const normalizedBaseUrl = validateSettingsForRequest(settings);
  const url = `${normalizedBaseUrl}/models`;

  const response = await fetch(url, {
    method: 'GET',
    headers: createAuthHeaders(settings)
  });

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new Error(`Connection test failed (${response.status}): ${detail}`);
  }

  return 'Connection successful.';
}

export async function chatCompletion(
  settings: EndpointSettings,
  messages: ChatMessage[]
): Promise<ChatResult> {
  const normalizedBaseUrl = validateSettingsForRequest(settings);
  const url = `${normalizedBaseUrl}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: createAuthHeaders(settings),
    body: JSON.stringify({
      model: settings.model.trim(),
      messages
    })
  });

  if (!response.ok) {
    const detail = await readErrorDetail(response);

    throw new Error(`Request failed (${response.status}): ${detail}`);
  }

  const json = (await response.json()) as CompletionResponse;
  const message = json.choices?.[0]?.message?.content?.trim();

  if (!message) {
    throw new Error('Endpoint returned an empty response.');
  }

  return { message };
}

export async function chatCompletionStream(
  settings: EndpointSettings,
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  options: StreamOptions = {}
): Promise<ChatResult> {
  const normalizedBaseUrl = validateSettingsForRequest(settings);
  const url = `${normalizedBaseUrl}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: createAuthHeaders(settings),
    signal: options.signal,
    body: JSON.stringify({
      model: settings.model.trim(),
      messages,
      stream: true
    })
  });

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new Error(`Streaming request failed (${response.status}): ${detail}`);
  }

  const message = await readStreamingCompletion(response, callbacks);
  return { message };
}
