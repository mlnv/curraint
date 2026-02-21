import { requiresApiKeyForProvider } from './providers';
import type { ChatMessage, ChatResult, EndpointSettings } from './types';

type CompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
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
