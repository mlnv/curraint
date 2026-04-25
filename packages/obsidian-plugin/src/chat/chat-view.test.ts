// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ChatView } from './chat-view';

describe('ChatView context popup', () => {
  it('adds a hover bridge so the popup stays reachable from the meter', () => {
    const view = new ChatView({} as never, {} as never) as ChatView & {
      buildControls: () => HTMLDivElement;
    };

    const controls = view.buildControls();
    const bridge = controls.querySelector('.curraint-chat-header__context-popup-bridge');

    expect(bridge).not.toBeNull();
    expect(bridge?.getAttribute('aria-hidden')).toBe('true');
  });
});