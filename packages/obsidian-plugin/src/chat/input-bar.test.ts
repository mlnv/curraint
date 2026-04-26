// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { InputBar } from './input-bar';

vi.mock('obsidian', () => ({
  setIcon: () => {},
}));

function createInputBar(container = document.createElement('div')): {
  container: HTMLDivElement;
  inputBar: InputBar;
} {
  return {
    container,
    inputBar: new InputBar(container, {
      onSubmit: () => {},
      onAddCurrentNote: () => {},
      onNoteAdd: () => {},
      onNoteRemove: () => {},
      onStop: () => {},
    }),
  };
}

describe('InputBar', () => {
  it('renders trailing actions in the bottom bar beside add notes', () => {
    const { container, inputBar } = createInputBar();

    const trailingAction = document.createElement('div');
    trailingAction.className = 'test-trailing-action';
    inputBar.attachTrailingAction(trailingAction);

    const mainRow = container.querySelector('.curraint-input-bar');
    const bottomBar = container.querySelector('.curraint-input-bottom-bar');
    const actionBar = container.querySelector('.curraint-input-bar__actions');
    const sendButton = actionBar?.querySelector('button');

    expect(mainRow?.querySelector('.test-trailing-action')).toBeNull();
    expect(bottomBar?.querySelector('.test-trailing-action')).toBe(trailingAction);
    expect(bottomBar?.querySelector('.curraint-input-bar__note-add')).not.toBeNull();
    expect(trailingAction.nextElementSibling).toBe(sendButton);
  });

  it('replaces the previous trailing action and does not duplicate the same node', () => {
    const { container, inputBar } = createInputBar();

    const firstAction = document.createElement('div');
    firstAction.className = 'first-trailing-action';
    const secondAction = document.createElement('div');
    secondAction.className = 'second-trailing-action';

    inputBar.attachTrailingAction(firstAction);
    inputBar.attachTrailingAction(firstAction);
    inputBar.attachTrailingAction(secondAction);

    const bottomBar = container.querySelector('.curraint-input-bottom-bar');
    expect(bottomBar?.querySelectorAll('.first-trailing-action')).toHaveLength(0);
    expect(bottomBar?.querySelectorAll('.second-trailing-action')).toHaveLength(1);
  });

  it('removes trailing actions on destroy', () => {
    const { container, inputBar } = createInputBar();

    const trailingAction = document.createElement('div');
    trailingAction.className = 'test-trailing-action';
    inputBar.attachTrailingAction(trailingAction);

    inputBar.destroy();

    expect(container.querySelector('.test-trailing-action')).toBeNull();
  });

  it('keeps trailing actions when mounted into the document later', () => {
    const { container, inputBar } = createInputBar();

    const trailingAction = document.createElement('div');
    trailingAction.className = 'test-trailing-action';
    inputBar.attachTrailingAction(trailingAction);

    document.body.appendChild(container);

    expect(container.querySelector('.curraint-input-bottom-bar .test-trailing-action')).toBe(trailingAction);
    container.remove();
  });
});