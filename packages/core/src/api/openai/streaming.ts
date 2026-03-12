import type { TokenUsage } from '../../types';
import type { CompletionResponse, StreamCallbacks } from './types';

export function extractDelta(json: CompletionResponse): string {
  return (
    json.choices?.[0]?.delta?.content ??
    json.choices?.[0]?.message?.content ??
    json.choices?.[0]?.text ??
    ''
  );
}

function parseDataLines(eventBlock: string): string[] {
  return eventBlock
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter((raw) => raw && raw !== '[DONE]');
}

type SseBlockResult = { chunk: string; usage?: TokenUsage };

function processSseBlock(block: string, callbacks: StreamCallbacks): SseBlockResult {
  let chunk = '';
  let usage: TokenUsage | undefined;
  for (const raw of parseDataLines(block)) {
    try {
      const parsed = JSON.parse(raw) as CompletionResponse;
      const delta = extractDelta(parsed);
      if (delta) {
        chunk += delta;
        callbacks.onDelta(delta);
      }
      if (parsed.usage) {
        usage = {
          prompt_tokens: parsed.usage.prompt_tokens,
          completion_tokens: parsed.usage.completion_tokens,
          total_tokens: parsed.usage.total_tokens,
        };
      }
    } catch {
      // ignore malformed lines
    }
  }
  return { chunk, usage };
}

export type StreamingCompletionResult = { message: string; usage?: TokenUsage };

export async function readStreamingCompletion(
  response: Response,
  callbacks: StreamCallbacks
): Promise<StreamingCompletionResult> {
  if (!response.body) throw new Error('Streaming response body is unavailable.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let message = '';
  let usage: TokenUsage | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep = buffer.indexOf('\n\n');
    while (sep >= 0) {
      const result = processSseBlock(buffer.slice(0, sep), callbacks);
      message += result.chunk;
      if (result.usage) usage = result.usage;
      buffer = buffer.slice(sep + 2);
      sep = buffer.indexOf('\n\n');
    }
  }

  const finalMessage = message.trim();
  if (!finalMessage) throw new Error('Endpoint returned an empty streaming response.');
  return { message: finalMessage, usage };
}
