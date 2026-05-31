import { beforeEach, describe, expect, it, vi } from 'vitest';

const { buildPiTransport } = vi.hoisted(() => ({
  buildPiTransport: vi.fn(),
}));

const { requestUrl, Platform } = vi.hoisted(() => ({
  requestUrl: vi.fn(),
  Platform: { isMobile: false },
}));

vi.mock('obsidian', () => ({
  requestUrl,
  Platform,
}));

vi.mock('@curraint/core', () => ({
  buildPiTransport,
}));

import { buildTransport } from './transport';
import type CurraintPlugin from './main';

function makePlugin(provider = 'openai') {
  return {
    settings: {
      provider,
      apiKeyEncrypted: '',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      systemPrompt: '',
      contextMaxMessages: 40,
      contextMaxCharacters: 24000,
      enableSessionSaving: false,
      mobileDeviceKey: '',
    },
    secrets: { decrypt: vi.fn().mockResolvedValue(''), encrypt: vi.fn() },
  } satisfies Pick<CurraintPlugin, 'settings' | 'secrets'>;
}

describe('buildTransport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Platform.isMobile = false;
  });

  it('delegates to buildPiTransport for openai provider', async () => {
    const piTransport = {
      streamChat: vi.fn().mockResolvedValue({ text: 'Hello', usage: undefined }),
      clearSession: vi.fn(),
    };
    buildPiTransport.mockReturnValue(piTransport);

    const transport = buildTransport(makePlugin('openai'));
    const onDelta = vi.fn();
    const result = await transport.streamChat(
      [{ role: 'user', content: 'Hi' }],
      onDelta
    );

    expect(result).toEqual({ text: 'Hello', usage: undefined });
    expect(buildPiTransport).toHaveBeenCalledTimes(1);
    expect(piTransport.streamChat).toHaveBeenCalledTimes(1);
  });

  it('passes the abort signal to the pi transport', async () => {
    const controller = new AbortController();
    const piTransport = {
      streamChat: vi.fn().mockResolvedValue({ text: '' }),
      clearSession: vi.fn(),
    };
    buildPiTransport.mockReturnValue(piTransport);

    const transport = buildTransport(makePlugin('openai'));
    const onDelta = vi.fn();
    await transport.streamChat(
      [{ role: 'user', content: 'Hi' }],
      onDelta,
      { signal: controller.signal }
    );

    expect(piTransport.streamChat).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Function),
      { signal: controller.signal }
    );
  });

  it('throws for LM Studio on mobile', async () => {
    Platform.isMobile = true;

    const plugin = makePlugin('lmstudio');
    const transport = buildTransport(plugin);
    const onDelta = vi.fn();

    await expect(
      transport.streamChat([{ role: 'user', content: 'Hi' }], onDelta)
    ).rejects.toThrow('LM Studio is not available on mobile');
  });
});
