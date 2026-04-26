import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EndpointSettings } from '@curraint/core';

vi.mock('@curraint/core', async (importActual) => {
  const actual = await importActual<typeof import('@curraint/core')>();
  return {
    ...actual,
    loadSettingsFromFile: vi.fn(),
  };
});

import { CONTEXT_SAFETY_LIMIT_BOUNDS, loadSettingsFromFile } from '@curraint/core';
import { applyCliEnvironmentOverrides, loadSettings } from './settings';

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

  it('treats fractional-looking env vars as invalid integers', () => {
    process.env['CURRAINT_CONTEXT_MAX_MESSAGES'] = '10.0';

    const result = loadSettings();
    const overridden = applyCliEnvironmentOverrides(FILE_SETTINGS);

    expect(result.contextMaxMessages).toBe(FILE_SETTINGS.contextMaxMessages);
    expect(overridden.contextMaxMessages).toBe(FILE_SETTINGS.contextMaxMessages);
  });

  it('normalizes out-of-range env vars through the shared bounds', () => {
    process.env['CURRAINT_CONTEXT_MAX_MESSAGES'] = '9999';
    process.env['CURRAINT_CONTEXT_MAX_CHARACTERS'] = '9999999';

    const result = loadSettings();

    expect(result.contextMaxMessages).toBe(1200);
    expect(result.contextMaxCharacters).toBe(2000000);
  });

  it('clamps low env vars up to the shared minimums', () => {
    process.env['CURRAINT_CONTEXT_MAX_MESSAGES'] = '1';
    process.env['CURRAINT_CONTEXT_MAX_CHARACTERS'] = '1000';

    const result = loadSettings();

    expect(result.contextMaxMessages).toBe(CONTEXT_SAFETY_LIMIT_BOUNDS.minMessages);
    expect(result.contextMaxCharacters).toBe(CONTEXT_SAFETY_LIMIT_BOUNDS.minCharacters);
  });
});