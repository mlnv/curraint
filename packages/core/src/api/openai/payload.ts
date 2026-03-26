import type { ChatMessage } from '../../types';
import type { EndpointSettings } from '../../settings/types';

type OpenAiApiMessage = Pick<ChatMessage, 'role' | 'content'>;

export type OpenAiPayload = {
  model: string;
  messages: OpenAiApiMessage[];
  stream?: true;
  stream_options?: {
    include_usage: true;
  };
};

type OpenAiPayloadOptions = {
  stream?: boolean;
};

export function sanitizeOpenAiMessages(messages: ChatMessage[]): OpenAiApiMessage[] {
  return messages.map(({ role, content }) => ({ role, content }));
}

export function supportsOpenAiStreamOptions(provider: EndpointSettings['provider']): boolean {
  return provider === 'openai' || provider === 'copilot';
}

export function buildOpenAiPayload(
  settings: EndpointSettings,
  messages: ChatMessage[],
  options: OpenAiPayloadOptions = {}
): OpenAiPayload {
  const payload: OpenAiPayload = {
    model: settings.model.trim(),
    messages: sanitizeOpenAiMessages(messages),
  };

  if (!options.stream) {
    return payload;
  }

  payload.stream = true;
  if (supportsOpenAiStreamOptions(settings.provider)) {
    payload.stream_options = { include_usage: true };
  }

  return payload;
}
