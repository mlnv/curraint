import { afterEach, describe, expect, it, vi } from 'vitest';
import { chatCompletion, chatCompletionStream, testConnection } from './client';
import type { EndpointSettings } from '../../settings/types';

const validSettings: EndpointSettings = {
  provider: 'openai',
  apiKey: 'test-key',
  baseUrl: 'https://api.example.com',
  model: 'test-model',
  systemPrompt: '',
  contextMaxMessages: 40,
  contextMaxCharacters: 24000
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('chatCompletion', () => {
  it('throws when api key is missing', async () => {
    await expect(
      chatCompletion({ ...validSettings, apiKey: ' ' }, [])
    ).rejects.toThrow('API key is missing');
  });

  it('throws when base url is missing', async () => {
    await expect(
      chatCompletion({ ...validSettings, baseUrl: ' ' }, [])
    ).rejects.toThrow('API base URL is missing');
  });

  it('calls /v1/chat/completions when /v1 is missing', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ message: { content: 'hello' } }] }),
          { status: 200 }
        )
      );

    await chatCompletion(validSettings, [{ role: 'user', content: 'Hi' }]);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/v1/chat/completions',
      expect.any(Object)
    );
  });

  it('keeps /v1 when base url already contains it', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ message: { content: 'hello' } }] }),
          { status: 200 }
        )
      );

    await chatCompletion(
      { ...validSettings, baseUrl: 'https://api.example.com/v1' },
      [{ role: 'user', content: 'Hi' }]
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/v1/chat/completions',
      expect.any(Object)
    );
  });

  it('surfaces API error message from JSON response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Invalid API key' } }), { status: 401 })
    );

    await expect(
      chatCompletion(validSettings, [{ role: 'user', content: 'Hi' }])
    ).rejects.toThrow('Request failed (401): Invalid API key');
  });

  it('throws when endpoint returns empty content', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: ' ' } }] }), { status: 200 })
    );

    await expect(
      chatCompletion(validSettings, [{ role: 'user', content: 'Hi' }])
    ).rejects.toThrow('Endpoint returned an empty response.');
  });

  it('returns assistant message on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: 'Answer' } }] }),
        { status: 200 }
      )
    );

    await expect(
      chatCompletion(validSettings, [{ role: 'user', content: 'Hi' }])
    ).resolves.toEqual({ message: 'Answer' });
  });

  it('allows LM Studio without API key and omits authorization header', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ message: { content: 'Local Answer' } }] }),
          { status: 200 }
        )
      );

    await chatCompletion(
      { ...validSettings, provider: 'lmstudio', apiKey: '', baseUrl: 'http://127.0.0.1:1234/v1' },
      [{ role: 'user', content: 'Hi' }]
    );

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = requestInit?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });
});

describe('testConnection', () => {
  it('returns success message for healthy endpoint', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), { status: 200 })
    );

    await expect(testConnection(validSettings)).resolves.toBe('Connection successful.');
  });

  it('surfaces status and message on failed endpoint', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Server unavailable' } }), { status: 503 })
    );

    await expect(testConnection(validSettings)).rejects.toThrow(
      'Connection test failed (503): Server unavailable'
    );
  });
});

describe('chatCompletionStream', () => {
  it('streams delta chunks and returns final response', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n'));
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"lo"}}]}\n\n'));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(stream, { status: 200 }));

    const deltas: string[] = [];
    const result = await chatCompletionStream(
      validSettings,
      [{ role: 'user', content: 'Hi' }],
      { onDelta: (delta) => deltas.push(delta) }
    );

    expect(deltas).toEqual(['Hel', 'lo']);
    expect(result).toEqual({ message: 'Hello' });
  });

  it('throws on empty streaming payload', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(stream, { status: 200 }));

    await expect(
      chatCompletionStream(validSettings, [{ role: 'user', content: 'Hi' }], {
        onDelta: () => undefined
      })
    ).rejects.toThrow('Endpoint returned an empty streaming response.');
  });
});
