// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createContextPopover } from './chat-view';

describe('ChatView context popup', () => {
  it('creates the context meter and summarize action without private casts', () => {
    const onSummarize = vi.fn();
    const popover = createContextPopover(onSummarize);
    const summarizeButton = popover.root.querySelector('.curraint-chat-header__context-action');

    expect(popover.root.querySelector('.curraint-chat-header__context-meter')).toBe(popover.meterButton);
    expect(summarizeButton).not.toBeNull();

    summarizeButton?.dispatchEvent(new MouseEvent('click'));
    expect(onSummarize).toHaveBeenCalledTimes(1);
  });

  it('adds a hover bridge so the popup stays reachable from the meter', () => {
    const popover = createContextPopover(() => {});
    const bridge = popover.root.querySelector('.curraint-chat-header__context-popup-bridge');

    expect(bridge).not.toBeNull();
    expect(bridge?.getAttribute('aria-hidden')).toBe('true');
  });
});