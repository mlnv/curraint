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

function processSseBlock(block: string, callbacks: StreamCallbacks): string {
  let chunk = '';
  for (const raw of parseDataLines(block)) {
    try {
      const delta = extractDelta(JSON.parse(raw) as CompletionResponse);
      if (delta) {
        chunk += delta;
        callbacks.onDelta(delta);
      }
    } catch {
      // ignore malformed lines
    }
  }
  return chunk;
}

export async function readStreamingCompletion(
  response: Response,
  callbacks: StreamCallbacks
): Promise<string> {
  if (!response.body) throw new Error('Streaming response body is unavailable.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let message = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep = buffer.indexOf('\n\n');
    while (sep >= 0) {
      message += processSseBlock(buffer.slice(0, sep), callbacks);
      buffer = buffer.slice(sep + 2);
      sep = buffer.indexOf('\n\n');
    }
  }

  const finalMessage = message.trim();
  if (!finalMessage) throw new Error('Endpoint returned an empty streaming response.');
  return finalMessage;
}
