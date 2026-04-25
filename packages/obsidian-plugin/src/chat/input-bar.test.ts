// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { InputBar } from './input-bar';

vi.mock('obsidian', () => ({
  setIcon: () => {},
}));

describe('InputBar', () => {
  it('renders trailing actions in the bottom bar beside add notes', () => {
    const container = document.createElement('div');
    const inputBar = new InputBar(container, {
      onSubmit: () => {},
      onAddCurrentNote: () => {},
      onNoteAdd: () => {},
      onNoteRemove: () => {},
      onStop: () => {},
    });

    const trailingAction = document.createElement('div');
    trailingAction.className = 'test-trailing-action';
    inputBar.attachTrailingAction(trailingAction);

    const mainRow = container.querySelector('.curraint-input-bar');
    const bottomBar = container.querySelector('.curraint-input-bottom-bar');

    expect(mainRow?.querySelector('.test-trailing-action')).toBeNull();
    expect(bottomBar?.querySelector('.test-trailing-action')).toBe(trailingAction);
    expect(bottomBar?.querySelector('.curraint-input-bar__note-add')).not.toBeNull();
  });
});