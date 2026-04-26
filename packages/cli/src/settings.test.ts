import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EndpointSettings } from '@curraint/core';

vi.mock('@curraint/core', async (importActual) => {
  const actual = await importActual<typeof import('@curraint/core')>();
  return {
    ...actual,
    loadSettingsFromFile: vi.fn(),
  };
});

import { loadSettingsFromFile } from '@curraint/core';
import { loadSettings } from './settings';

const ORIGINAL_ENV = { ...process.env };

const FILE_SETTINGS: EndpointSettings = {
  provider: 'openai',
  apiKey: 'file-key',
  baseUrl: 'https://example.com/v1',
  model: 'file-model',
  systemPrompt: 'File system prompt',
  contextMaxMessages: 55,
  contextMaxCharacters: 32000,
  enableSessionSaving: true,
};

describe('loadSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    delete process.env['CURRAINT_CONTEXT_MAX_MESSAGES'];
    delete process.env['CURRAINT_CONTEXT_MAX_CHARACTERS'];
    vi.mocked(loadSettingsFromFile).mockReturnValue(FILE_SETTINGS);
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('overrides file settings with CURRAINT_CONTEXT_MAX_MESSAGES', () => {
    process.env['CURRAINT_CONTEXT_MAX_MESSAGES'] = '80';

    const result = loadSettings();

    expect(result.contextMaxMessages).toBe(80);
    expect(result.contextMaxCharacters).toBe(32000);
  });

  it('overrides file settings with CURRAINT_CONTEXT_MAX_CHARACTERS', () => {
    process.env['CURRAINT_CONTEXT_MAX_CHARACTERS'] = '64000';

    const result = loadSettings();

    expect(result.contextMaxMessages).toBe(55);
    expect(result.contextMaxCharacters).toBe(64000);
  });

  it('ignores invalid context env vars and preserves file values', () => {
    process.env['CURRAINT_CONTEXT_MAX_MESSAGES'] = 'abc';
    process.env['CURRAINT_CONTEXT_MAX_CHARACTERS'] = '12.5';

    const result = loadSettings();

    expect(result.contextMaxMessages).toBe(55);
    expect(result.contextMaxCharacters).toBe(32000);
  });

  it('normalizes out-of-range env vars through the shared bounds', () => {
    process.env['CURRAINT_CONTEXT_MAX_MESSAGES'] = '9999';
    process.env['CURRAINT_CONTEXT_MAX_CHARACTERS'] = '100';

    const result = loadSettings();

    expect(result.contextMaxMessages).toBe(120);
    expect(result.contextMaxCharacters).toBe(4000);
  });
});