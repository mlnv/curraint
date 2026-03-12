import {
  chatCompletion,
  chatCompletionStream,
  copilotChatStream,
  resetCopilotSession,
  composeConversation,
  ENABLE_COPILOT_PROVIDER,
} from '@curraint/core';
import type { EndpointSettings, ChatSessionTransport } from '@curraint/core';

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

function buildCopilotTransport(settings: EndpointSettings): ChatSessionTransport {
  return {
    streamChat: async (messages, onDelta, options) => {
      const composed = composeConversation(settings, messages);
      let streamedMessage = '';
      try {
        const result = await copilotChatStream(
          settings.model,
          composed,
          {
            onDelta: (delta) => {
              streamedMessage += delta;
              onDelta(delta);
            },
          },
          { signal: options?.signal }
        );
        return { text: result.message, usage: result.usage };
      } catch (error) {
        if (isAbortError(error)) return { text: streamedMessage };
        throw error;
      }
    },
    clearSession: () => resetCopilotSession(settings.model, settings.systemPrompt),
  };
}

function buildOpenAiTransport(settings: EndpointSettings): ChatSessionTransport {
  return {
    streamChat: async (messages, onDelta, options) => {
      const composed = composeConversation(settings, messages);
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
        const fallback = await chatCompletion(settings, composed);
        return { text: fallback.message, usage: fallback.usage };
      }
    },
  };
}

export function buildTransport(settings: EndpointSettings): ChatSessionTransport {
  if (ENABLE_COPILOT_PROVIDER && settings.provider === 'copilot') {
    return buildCopilotTransport(settings);
  }
  return buildOpenAiTransport(settings);
}
