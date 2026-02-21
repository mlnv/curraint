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

function normalizeBaseUrl(baseUrl: string): string {
  const candidate = baseUrl.trim();
  if (!candidate) {
    throw new Error('API base URL is missing. Please set it in Settings.');
  }

  const trimmed = candidate.replace(/\/$/, '');
  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
}

export async function chatCompletion(
  settings: EndpointSettings,
  messages: ChatMessage[]
): Promise<ChatResult> {
  if (!settings.apiKey.trim()) {
    throw new Error('API key is missing. Please set it in Settings.');
  }

  if (!settings.model.trim()) {
    throw new Error('Model is missing. Please set it in Settings.');
  }

  const url = `${normalizeBaseUrl(settings.baseUrl)}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.model.trim(),
      messages
    })
  });

  if (!response.ok) {
    const text = await response.text();
    let detail = text;

    try {
      const parsed = JSON.parse(text) as CompletionResponse;
      detail = parsed.error?.message ?? text;
    } catch {
      detail = text;
    }

    throw new Error(`Request failed (${response.status}): ${detail}`);
  }

  const json = (await response.json()) as CompletionResponse;
  const message = json.choices?.[0]?.message?.content?.trim();

  if (!message) {
    throw new Error('Endpoint returned an empty response.');
  }

  return { message };
}
