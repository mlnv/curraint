import { describe, it, expect } from 'vitest';
import {
  buildLmsUrl,
  buildCompletionsUrl,
  resolveEffectiveLmsSettings,
} from './transport';
import type { EndpointSettings } from '@curraint/core';

// Minimal EndpointSettings factory - only fields used by the tested functions.
function makeSettings(overrides: Partial<EndpointSettings> = {}): EndpointSettings {
  return {
    provider: 'lmstudio',
    apiKey: '',
    baseUrl: 'http://localhost:1234',
    model: 'qwen2.5-7b',
    systemPrompt: '',
    contextMaxMessages: 40,
    contextMaxCharacters: 80000,
    enableSessionSaving: false,
    ...overrides,
  } as EndpointSettings;
}

// ---------------------------------------------------------------------------
// buildLmsUrl
// ---------------------------------------------------------------------------

describe('buildLmsUrl', () => {
  it('appends /api/v1/chat to a plain base URL', () => {
    expect(buildLmsUrl('http://localhost:1234')).toBe('http://localhost:1234/api/v1/chat');
  });

  it('strips a trailing slash before appending the path', () => {
    expect(buildLmsUrl('http://localhost:1234/')).toBe('http://localhost:1234/api/v1/chat');
  });

  it('strips a trailing /v1 suffix left over from old default URLs', () => {
    expect(buildLmsUrl('http://localhost:1234/v1')).toBe('http://localhost:1234/api/v1/chat');
  });

  it('strips /v1/ (with trailing slash) as well', () => {
    expect(buildLmsUrl('http://localhost:1234/v1/')).toBe('http://localhost:1234/api/v1/chat');
  });
});

// ---------------------------------------------------------------------------
// buildCompletionsUrl
// ---------------------------------------------------------------------------

describe('buildCompletionsUrl', () => {
  it('appends /v1/chat/completions to a plain base URL', () => {
    expect(buildCompletionsUrl('http://localhost:11434')).toBe(
      'http://localhost:11434/v1/chat/completions'
    );
  });

  it('strips a trailing slash before appending the path', () => {
    expect(buildCompletionsUrl('http://localhost:11434/')).toBe(
      'http://localhost:11434/v1/chat/completions'
    );
  });

  it('does not double /v1 when the base URL already ends with /v1', () => {
    expect(buildCompletionsUrl('https://api.openai.com/v1')).toBe(
      'https://api.openai.com/v1/chat/completions'
    );
  });

  it('does not double /v1 when the base URL already ends with /v1/', () => {
    expect(buildCompletionsUrl('https://api.openai.com/v1/')).toBe(
      'https://api.openai.com/v1/chat/completions'
    );
  });
});

// ---------------------------------------------------------------------------
// resolveEffectiveLmsSettings
// ---------------------------------------------------------------------------

describe('resolveEffectiveLmsSettings', () => {
  it('returns the same settings object when there are no system messages', () => {
    const settings = makeSettings({ systemPrompt: 'You are helpful.' });
    const messages = [{ role: 'user', content: 'Hello' }];
    expect(resolveEffectiveLmsSettings(settings, messages)).toBe(settings);
  });

  it('merges a single conversation system message with the static system prompt', () => {
    const settings = makeSettings({ systemPrompt: 'You are helpful.' });
    const messages = [
      { role: 'system', content: 'Note context: foo' },
      { role: 'user', content: 'Hello' },
    ];
    const result = resolveEffectiveLmsSettings(settings, messages);
    expect(result).not.toBe(settings);
    expect(result.systemPrompt).toBe('You are helpful.\n\nNote context: foo');
  });

  it('uses only the conversation system message when the static prompt is empty', () => {
    const settings = makeSettings({ systemPrompt: '' });
    const messages = [{ role: 'system', content: 'Note context: bar' }];
    const result = resolveEffectiveLmsSettings(settings, messages);
    expect(result.systemPrompt).toBe('Note context: bar');
  });

  it('does not mutate the original settings object', () => {
    const settings = makeSettings({ systemPrompt: 'Original' });
    const messages = [{ role: 'system', content: 'Injected context' }];
    resolveEffectiveLmsSettings(settings, messages);
    expect(settings.systemPrompt).toBe('Original');
  });

  it('merges multiple conversation system messages in order', () => {
    const settings = makeSettings({ systemPrompt: 'Base' });
    const messages = [
      { role: 'system', content: 'First' },
      { role: 'user', content: 'Hello' },
      { role: 'system', content: 'Second' },
    ];
    const result = resolveEffectiveLmsSettings(settings, messages);
    expect(result.systemPrompt).toBe('Base\n\nFirst\n\nSecond');
  });

  it('returns the original settings when the merged prompt equals the existing one', () => {
    // Edge case: static prompt already contains the same text.
    const settings = makeSettings({ systemPrompt: 'Same' });
    const messages = [{ role: 'system', content: 'Same' }];
    const result = resolveEffectiveLmsSettings(settings, messages);
    // The merged string 'Same\n\nSame' differs from 'Same' so a new object IS returned.
    expect(result.systemPrompt).toBe('Same\n\nSame');
  });
});
