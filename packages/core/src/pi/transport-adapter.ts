import { streamSimple } from '@earendil-works/pi-ai';
import type { Context, SimpleStreamOptions, AssistantMessageEvent, Usage } from '@earendil-works/pi-ai';

import type { ChatMessage, TokenUsage } from '../types';
import type { ChatStreamResult } from '../chat/types';
import type { EndpointSettings } from '../settings/types';
import type { ChatSessionTransport } from '../chat/types';
import { composeConversation } from '../settings/composer';
import { curraintToPiMessages } from './message-mapper';
import { resolvePiModel, resolveApiKey } from './provider-registry';
import { debugLog } from '../debug/log';

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

function convertUsage(usage?: Usage): TokenUsage | undefined {
  if (!usage) return undefined;
  return {
    prompt_tokens: usage.input,
    completion_tokens: usage.output,
    total_tokens: usage.totalTokens
  };
}

export function buildPiTransport(settings: EndpointSettings): ChatSessionTransport {
  const { model } = resolvePiModel(settings);
  const getKey = () => resolveApiKey(settings);

  return {
    streamChat: async (messages, onDelta, options) => {
      const composed = composeConversation(settings, messages);

      const systemPrompt = settings.systemPrompt || undefined;

      const piMessages = curraintToPiMessages(
        composed.filter(m => m.role !== 'system')
      );

      const context: Context = {
        systemPrompt,
        messages: piMessages as Context['messages']
      };

      const streamOptions: SimpleStreamOptions = {
        signal: options?.signal,
        apiKey: getKey() || undefined
      };

      debugLog('API', 'pi stream starting', {
        model: model.id,
        messageCount: piMessages.length
      });

      let streamedText = '';
      let finalUsage: Usage | undefined;

      try {
        const eventStream = streamSimple(model, context, streamOptions);

        for await (const event of eventStream) {
          switch (event.type) {
            case 'text_delta': {
              streamedText += event.delta;
              onDelta(event.delta);
              break;
            }
            case 'thinking_delta': {
              onDelta(event.delta);
              break;
            }
            case 'done': {
              finalUsage = event.message.usage;
              break;
            }
            case 'error': {
              const errorMsg = event.error.errorMessage || 'Stream error';
              throw new Error(errorMsg);
            }
          }
        }

        debugLog('API', 'pi stream complete', {
          textLength: streamedText.length,
          usage: finalUsage
        });

        return {
          text: streamedText.trim() || eventStream as any,
          usage: convertUsage(finalUsage)
        } as ChatStreamResult;
      } catch (error) {
        if (isAbortError(error)) {
          return { text: streamedText };
        }
        debugLog('API', 'pi stream error', error);
        throw error;
      }
    },

    clearSession: async () => {
      // pi-ai doesn't have explicit session clearing
    }
  };
}
