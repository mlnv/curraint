import { describe, expect, it } from 'vitest';

import { getVisibleProviderOptions } from './provider-options';

describe('getVisibleProviderOptions', () => {
  it('includes GitHub Copilot when the runtime feature flag is enabled', () => {
    const options = getVisibleProviderOptions('openai', {
      enableCopilotProvider: true
    });

    expect(options.some((option) => option.id === 'copilot')).toBe(true);
  });

  it('keeps GitHub Copilot visible when it is already the selected provider', () => {
    const options = getVisibleProviderOptions('copilot', {
      enableCopilotProvider: false
    });

    expect(options.some((option) => option.id === 'copilot')).toBe(true);
  });

  it('hides GitHub Copilot when disabled and not currently selected', () => {
    const options = getVisibleProviderOptions('openai', {
      enableCopilotProvider: false
    });

    expect(options.some((option) => option.id === 'copilot')).toBe(false);
  });

  it('does not duplicate GitHub Copilot when it is both enabled and selected', () => {
    const options = getVisibleProviderOptions('copilot', {
      enableCopilotProvider: true
    });

    expect(options.filter((option) => option.id === 'copilot')).toHaveLength(1);
  });
});