import { describe, it, expect, beforeEach } from 'vitest';
import { InputHistory } from './input-history';

describe('InputHistory', () => {
  let history: InputHistory;

  beforeEach(() => {
    history = new InputHistory();
  });

  describe('push', () => {
    it('adds an entry that can be retrieved by navigateBack', () => {
      history.push('hello');
      expect(history.navigateBack('')).toBe('hello');
    });

    it('ignores empty strings', () => {
      history.push('');
      expect(history.navigateBack('')).toBeUndefined();
    });

    it('de-dupes consecutive identical entries', () => {
      history.push('hello');
      history.push('hello');
      history.push('hello');
      expect(history.navigateBack('')).toBe('hello');
      // Only one entry - navigating further should return undefined
      expect(history.navigateBack('')).toBeUndefined();
    });

    it('allows non-consecutive duplicates', () => {
      history.push('hello');
      history.push('world');
      history.push('hello');
      history.navigateBack(''); // hello (latest)
      history.navigateBack(''); // world
      expect(history.navigateBack('')).toBe('hello'); // oldest
    });
  });

  describe('navigateBack', () => {
    it('returns undefined when history is empty', () => {
      expect(history.navigateBack('')).toBeUndefined();
    });

    it('returns newest entry first', () => {
      history.push('first');
      history.push('second');
      history.push('third');
      expect(history.navigateBack('')).toBe('third');
    });

    it('returns older entries on repeated calls', () => {
      history.push('first');
      history.push('second');
      history.push('third');
      history.navigateBack('');
      history.navigateBack('');
      expect(history.navigateBack('')).toBe('first');
    });

    it('stays at oldest entry and returns undefined instead of wrapping', () => {
      history.push('only');
      history.navigateBack('');
      expect(history.navigateBack('')).toBeUndefined();
    });

    it('saves the current draft on the first call', () => {
      history.push('previous');
      history.navigateBack('my draft');
      expect(history.navigateForward()).toBe('my draft');
    });
  });

  describe('navigateForward', () => {
    it('returns undefined when not navigating', () => {
      expect(history.navigateForward()).toBeUndefined();
    });

    it('returns a more-recent entry when in the middle of history', () => {
      history.push('first');
      history.push('second');
      history.push('third');
      history.navigateBack(''); // third
      history.navigateBack(''); // second
      expect(history.navigateForward()).toBe('third');
    });

    it('restores the saved draft when reaching the live position', () => {
      history.push('previous');
      history.navigateBack('in progress');
      expect(history.navigateForward()).toBe('in progress');
    });

    it('returns undefined on further calls once draft is returned', () => {
      history.push('previous');
      history.navigateBack('draft');
      history.navigateForward(); // returns draft (live position)
      expect(history.navigateForward()).toBeUndefined();
    });
  });

  describe('isNavigating', () => {
    it('is false initially', () => {
      expect(history.isNavigating).toBe(false);
    });

    it('becomes true after navigateBack', () => {
      history.push('msg');
      history.navigateBack('');
      expect(history.isNavigating).toBe(true);
    });

    it('becomes false again after navigating fully forward', () => {
      history.push('msg');
      history.navigateBack('');
      history.navigateForward(); // returns draft - back at live position
      expect(history.isNavigating).toBe(false);
    });
  });

  describe('reset', () => {
    it('clears navigation state so next browse starts fresh', () => {
      history.push('first');
      history.push('second');
      history.navigateBack(''); // second
      history.reset();
      expect(history.isNavigating).toBe(false);
      // After reset, navigateBack should start from newest again
      expect(history.navigateBack('')).toBe('second');
    });

    it('clears the saved draft', () => {
      history.push('msg');
      history.navigateBack('my draft');
      history.reset();
      history.navigateBack('');
      history.navigateForward(); // back to live
      expect(history.navigateForward()).toBeUndefined();
    });
  });
});
