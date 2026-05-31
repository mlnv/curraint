import { describe, expect, it } from 'vitest';
import { resolvePiModel, resolveApiKey } from './provider-registry';
import type { EndpointSettings } from '../settings/types';

function makeSettings(overrides: Partial<EndpointSettings> = {}): EndpointSettings {
  return {
    provider: 'openai',
    apiKey: '',
    baseUrl: '',
    model: '',
    systemPrompt: '',
    contextMaxMessages: 40,
    contextMaxCharacters: 24000,
    enableSessionSaving: true,
    ...overrides
  };
}

describe('provider-registry', () => {
  describe('resolvePiModel', () => {
    it('resolves openai provider model', () => {
      const settings = makeSettings({
        provider: 'openai',
        model: 'openai/gpt-4o-mini'
      });
      const { model } = resolvePiModel(settings);
      expect(model.id).toBe('openai/gpt-4o-mini');
      expect(model.provider).toBe('openrouter');
      expect(model.api).toBe('openai-completions');
      expect(model.input).toContain('text');
    });

    it('resolves openai with default model when not specified', () => {
      const settings = makeSettings({ provider: 'openai', model: '' });
      const { model } = resolvePiModel(settings);
      expect(model.id).toBe('openai/gpt-4o-mini');
    });

    it('resolves copilot provider model', () => {
      const settings = makeSettings({
        provider: 'copilot',
        model: 'claude-haiku-4.5'
      });
      const { model } = resolvePiModel(settings);
      expect(model.id).toBe('claude-haiku-4.5');
      expect(model.provider).toBe('github-copilot');
    });

    it('creates custom model for lmstudio provider', () => {
      const settings = makeSettings({
        provider: 'lmstudio',
        baseUrl: 'http://127.0.0.1:1234/v1',
        model: 'llama-3'
      });
      const { model } = resolvePiModel(settings);
      expect(model.id).toBe('llama-3');
      expect(model.api).toBe('openai-completions');
      expect(model.baseUrl).toBe('http://127.0.0.1:1234/v1');
      expect(model.provider).toBe('openai');
    });

    it('creates custom model for custom provider', () => {
      const settings = makeSettings({
        provider: 'custom',
        baseUrl: 'https://my-endpoint.example.com/v1',
        model: 'my-model'
      });
      const { model } = resolvePiModel(settings);
      expect(model.id).toBe('my-model');
      expect(model.api).toBe('openai-completions');
      expect(model.baseUrl).toBe('https://my-endpoint.example.com/v1');
    });

    it('resolves deepseek provider model', () => {
      const settings = makeSettings({
        provider: 'deepseek',
        model: 'deepseek-v4-pro'
      });
      const { model } = resolvePiModel(settings);
      expect(model.id).toBe('deepseek-v4-pro');
      expect(model.api).toBe('openai-completions');
      expect(model.provider).toBe('openai');
      expect(model.baseUrl).toBe('https://api.deepseek.com');
      expect(model.contextWindow).toBe(1000000);
      expect(model.maxTokens).toBe(384000);
    });

    it('uses default model for deepseek when not specified', () => {
      const settings = makeSettings({ provider: 'deepseek', model: '' });
      const { model } = resolvePiModel(settings);
      expect(model.id).toBe('deepseek-v4-flash');
      expect(model.baseUrl).toBe('https://api.deepseek.com');
    });

    it('uses default baseUrl for lmstudio when not provided', () => {
      const settings = makeSettings({
        provider: 'lmstudio',
        model: 'local-model'
      });
      const { model } = resolvePiModel(settings);
      expect(model.baseUrl).toBe('http://127.0.0.1:1234');
    });

    it('falls back to custom model for unknown openai models', () => {
      const settings = makeSettings({
        provider: 'openai',
        model: 'nonexistent/unknown-model'
      });
      const { model } = resolvePiModel(settings);
      expect(model.id).toBe('nonexistent/unknown-model');
      expect(model.api).toBe('openai-completions');
    });
  });

  describe('resolveApiKey', () => {
    it('returns api key when set', () => {
      const settings = makeSettings({
        provider: 'openai',
        apiKey: 'sk-test-key'
      });
      expect(resolveApiKey(settings)).toBe('sk-test-key');
    });

    it('returns api key for deepseek', () => {
      const settings = makeSettings({
        provider: 'deepseek',
        apiKey: 'sk-deepseek-key'
      });
      expect(resolveApiKey(settings)).toBe('sk-deepseek-key');
    });

    it('returns undefined for openai when key is empty', () => {
      const settings = makeSettings({
        provider: 'openai',
        apiKey: ''
      });
      expect(resolveApiKey(settings)).toBeUndefined();
    });

    it('returns undefined for deepseek when key is empty', () => {
      const settings = makeSettings({
        provider: 'deepseek',
        apiKey: ''
      });
      expect(resolveApiKey(settings)).toBeUndefined();
    });

    it('returns undefined for providers that do not require api key', () => {
      const settings = makeSettings({
        provider: 'lmstudio',
        apiKey: ''
      });
      expect(resolveApiKey(settings)).toBeUndefined();
    });
  });
});
