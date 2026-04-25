// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ChatView } from './chat-view';

describe('ChatView context popup', () => {
  it('renders the context meter in the composer action row', () => {
    const actionRow = document.createElement('div');
    const sendButton = document.createElement('button');
    sendButton.className = 'curraint-input-bar__send';
    actionRow.appendChild(sendButton);

    const view = new ChatView({} as never, {} as never) as ChatView & {
      inputBar: { attachTrailingAction: (element: HTMLElement) => void };
      mountContextPopover: () => void;
    };
    view.inputBar = {
      attachTrailingAction: (element: HTMLElement) => {
        actionRow.insertBefore(element, sendButton);
      }
    };

    view.mountContextPopover();

    const contextPopover = actionRow.querySelector('.curraint-chat-header__context-popover');

    expect(contextPopover).not.toBeNull();
    expect(actionRow.firstElementChild).toBe(contextPopover);
  });

  it('adds a hover bridge so the popup stays reachable from the meter', () => {
    const view = new ChatView({} as never, {} as never) as ChatView & {
      createContextPopover: () => HTMLDivElement;
    };

    const popover = view.createContextPopover();
    const bridge = popover.querySelector('.curraint-chat-header__context-popup-bridge');

    expect(bridge).not.toBeNull();
    expect(bridge?.getAttribute('aria-hidden')).toBe('true');
  });
});