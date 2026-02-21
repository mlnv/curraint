import { afterEach, describe, expect, it, vi } from 'vitest';
import { chatCompletion } from './openaiCompatibleClient';
import type { EndpointSettings } from './types';

const validSettings: EndpointSettings = {
  apiKey: 'test-key',
  baseUrl: 'https://api.example.com',
  model: 'test-model',
  systemPrompt: ''
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
      new Response(JSON.stringify({ error: { message: 'Invalid API key' } }), {
        status: 401
      })
    );

    await expect(
      chatCompletion(validSettings, [{ role: 'user', content: 'Hi' }])
    ).rejects.toThrow('Request failed (401): Invalid API key');
  });

  it('throws when endpoint returns empty content', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: ' ' } }] }), {
        status: 200
      })
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
});
