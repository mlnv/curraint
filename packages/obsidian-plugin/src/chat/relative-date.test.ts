import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { relativeDate } from './relative-date';

describe('relativeDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-26T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns just now for recent timestamps', () => {
    expect(relativeDate(Date.now() - 30_000)).toBe('just now');
  });

  it('returns minutes for timestamps under one hour old', () => {
    expect(relativeDate(Date.now() - 5 * 60_000)).toBe('5m ago');
  });

  it('returns hours for timestamps under one day old', () => {
    expect(relativeDate(Date.now() - 3 * 60 * 60_000)).toBe('3h ago');
  });

  it('returns days for older timestamps', () => {
    expect(relativeDate(Date.now() - 2 * 24 * 60 * 60_000)).toBe('2d ago');
  });

  it('treats future timestamps as just now', () => {
    expect(relativeDate(Date.now() + 60_000)).toBe('just now');
  });
});
