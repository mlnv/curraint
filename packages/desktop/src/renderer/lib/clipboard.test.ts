// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { copyTextToClipboard } from './clipboard';

describe('copyTextToClipboard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false for empty input', async () => {
    await expect(copyTextToClipboard('')).resolves.toBe(false);
  });

  it('uses navigator.clipboard when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    });

    await expect(copyTextToClipboard('hello')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('falls back to execCommand when clipboard API fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    });

    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn(() => true)
    });

    const execSpy = vi.spyOn(document, 'execCommand');

    await expect(copyTextToClipboard('fallback')).resolves.toBe(true);
    expect(execSpy).toHaveBeenCalledWith('copy');
  });
});
