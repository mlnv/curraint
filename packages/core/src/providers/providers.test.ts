import { describe, expect, it } from 'vitest';
import { PROVIDER_CONFIGS, PROVIDER_OPTIONS, getProviderConfig, isProviderId, requiresApiKeyForProvider } from '.';

describe('isProviderId', () => {
  it('returns true for known providers', () => {
    expect(isProviderId('openai')).toBe(true);
    expect(isProviderId('lmstudio')).toBe(true);
    expect(isProviderId('custom')).toBe(true);
  });

  it('returns false for unknown provider values', () => {
    expect(isProviderId('azure')).toBe(false);
    expect(isProviderId('')).toBe(false);
  });
});

describe('provider configs', () => {
  it('all provider options have a corresponding config', () => {
    PROVIDER_OPTIONS.forEach((option) => {
      expect(PROVIDER_CONFIGS[option.id]).toBeDefined();
    });
  });

  it('returns provider config by id', () => {
    expect(getProviderConfig('openai').label).toBe('OpenAI (Cloud)');
    expect(getProviderConfig('lmstudio').defaultBaseUrl).toBe('http://127.0.0.1:1234/v1');
  });

  it('applies expected API key requirements', () => {
    expect(requiresApiKeyForProvider('openai')).toBe(true);
    expect(requiresApiKeyForProvider('lmstudio')).toBe(false);
    expect(requiresApiKeyForProvider('custom')).toBe(false);
  });
});
