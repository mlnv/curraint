import { describe, expect, it, vi } from 'vitest';
import type { WorkspaceLeaf } from 'obsidian';
import CurraintPlugin from './main';
import { ChatView, CHAT_VIEW_TYPE } from './chat/chat-view';

describe('CurraintPlugin - unload', () => {
  it('destroys chat registries before detaching chat leaves', () => {
    const calls: string[] = [];
    const destroyFirst = vi.fn(() => { calls.push('destroy:first'); });
    const destroySecond = vi.fn(() => { calls.push('destroy:second'); });
    const detachLeavesOfType = vi.fn(() => { calls.push('detach'); });

    const firstView = Object.assign(Object.create(ChatView.prototype), {
      destroyRegistry: destroyFirst,
    });
    const secondView = Object.assign(Object.create(ChatView.prototype), {
      destroyRegistry: destroySecond,
    });

    const leaves = [
      { view: firstView },
      { view: secondView },
    ] as WorkspaceLeaf[];

    const plugin = new CurraintPlugin();
    (plugin as CurraintPlugin & {
      app: {
        workspace: {
          getLeavesOfType: (viewType: string) => WorkspaceLeaf[];
          detachLeavesOfType: (viewType: string) => void;
        };
      };
    }).app = {
      workspace: {
        getLeavesOfType: (viewType: string) => {
          expect(viewType).toBe(CHAT_VIEW_TYPE);
          return leaves;
        },
        detachLeavesOfType,
      },
    };

    plugin.onunload();

    expect(destroyFirst).toHaveBeenCalledTimes(1);
    expect(destroySecond).toHaveBeenCalledTimes(1);
    expect(detachLeavesOfType).toHaveBeenCalledWith(CHAT_VIEW_TYPE);
    expect(calls).toEqual(['destroy:first', 'destroy:second', 'detach']);
  });
});