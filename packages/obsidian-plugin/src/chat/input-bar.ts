import { setIcon } from 'obsidian';
import type { TFile } from 'obsidian';

export type InputBarCallbacks = {
  onSubmit: (text: string) => void;
  onAddCurrentNote: () => void;
  onNoteAdd: () => void;
  onNoteRemove: (path: string) => void;
  onStop: () => void;
};

type NoteChipEntry = {
  element: HTMLElement;
  removeButton: HTMLButtonElement;
  removeHandler: () => void;
};

const NOOP_CALLBACKS: InputBarCallbacks = {
  onSubmit: () => {},
  onAddCurrentNote: () => {},
  onNoteAdd: () => {},
  onNoteRemove: () => {},
  onStop: () => {},
};

export class InputBar {
  private wrapper: HTMLElement | null;
  private textarea: HTMLTextAreaElement | null;
  private actionBar: HTMLElement | null;
  private sendButton: HTMLButtonElement | null;
  private stopButton: HTMLButtonElement | null;
  private addCurrentNoteButton: HTMLButtonElement | null;
  private noteAddButton: HTMLButtonElement | null;
  private contextBar: HTMLElement | null;
  private trailingAction: HTMLElement | null = null;
  private readonly noteChipMap = new Map<string, NoteChipEntry>();
  private callbacks: InputBarCallbacks;
  private readonly handleTextareaKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.trySubmit();
    }
  };
  private readonly handleTextareaInput = (): void => {
    this.autoResize();
  };
  private readonly handleSendClick = (): void => {
    this.trySubmit();
  };
  private readonly handleStopClick = (): void => {
    this.callbacks.onStop();
  };
  private readonly handleAddCurrentNoteClick = (): void => {
    this.callbacks.onAddCurrentNote();
  };
  private readonly handleNoteAddClick = (): void => {
    this.callbacks.onNoteAdd();
  };

  constructor(container: HTMLElement, callbacks: InputBarCallbacks) {
    this.callbacks = callbacks;

    const wrapper = document.createElement('div');
    wrapper.className = 'curraint-input-wrapper';
    this.wrapper = wrapper;

    // Top bar - quick-add current note button (always leftmost) + chips
    this.contextBar = document.createElement('div');
    this.contextBar.className = 'curraint-context-bar';

    this.addCurrentNoteButton = this.createButton(
      'curraint-input-bar__add-current-note',
      '+ Note',
      'Add current note to context'
    );
    this.addCurrentNoteButton.addEventListener('click', this.handleAddCurrentNoteClick);
    this.contextBar.appendChild(this.addCurrentNoteButton);


    // Main input row
    const bar = document.createElement('div');
    bar.className = 'curraint-input-bar';

    this.textarea = document.createElement('textarea');
    this.textarea.className = 'curraint-input-bar__textarea';
    this.textarea.placeholder =
      'Ask anything\u2026 (Enter to send, Shift+Enter for newline)';
    this.textarea.rows = 1;
    this.textarea.addEventListener('keydown', this.handleTextareaKeydown);
    this.textarea.addEventListener('input', this.handleTextareaInput);

    this.sendButton = this.createButton(
      'curraint-input-bar__send',
      '\u2191',
      'Send message'
    );
    this.sendButton.addEventListener('click', this.handleSendClick);

    this.stopButton = this.createButton(
      'curraint-input-bar__stop',
      '',
      'Stop response'
    );
    setIcon(this.stopButton, 'square');
    this.stopButton.style.display = 'none';
    this.stopButton.addEventListener('click', this.handleStopClick);

    this.actionBar = document.createElement('div');
    this.actionBar.className = 'curraint-input-bar__actions';
    this.actionBar.appendChild(this.sendButton);
    this.actionBar.appendChild(this.stopButton);

    bar.appendChild(this.textarea);

    // Bottom bar - browse-and-add-notes button
    const bottomBar = document.createElement('div');
    bottomBar.className = 'curraint-input-bottom-bar';

    this.noteAddButton = this.createButton(
      'curraint-input-bar__note-add',
      '+ Add notes',
      'Browse and add notes to context'
    );
    this.noteAddButton.addEventListener('click', this.handleNoteAddClick);
    bottomBar.appendChild(this.noteAddButton);
    bottomBar.appendChild(this.actionBar);

    wrapper.appendChild(this.contextBar);
    wrapper.appendChild(bar);
    wrapper.appendChild(bottomBar);
    container.appendChild(wrapper);
  }

  attachTrailingAction(element: HTMLElement): void {
    if (this.trailingAction === element) {
      return;
    }

    if (!this.actionBar || !this.sendButton) {
      return;
    }

    this.trailingAction?.remove();
    this.trailingAction = element;

    this.actionBar.insertBefore(element, this.sendButton);
  }

  /** Update the label on the quick-add button to reflect the active note title. */
  setCurrentNoteTitle(title: string | null): void {
    if (!this.addCurrentNoteButton) return;

    this.addCurrentNoteButton.textContent = title ? `+ ${title}` : '+ Note';
    this.addCurrentNoteButton.title = title
      ? `Add "${title}" to context`
      : 'Add current note to context';
  }

  setLoading(loading: boolean): void {
    if (
      !this.textarea ||
      !this.addCurrentNoteButton ||
      !this.noteAddButton ||
      !this.sendButton ||
      !this.stopButton
    ) {
      return;
    }

    this.textarea.disabled = loading;
    this.addCurrentNoteButton.disabled = loading;
    this.noteAddButton.disabled = loading;
    this.sendButton.style.display = loading ? 'none' : '';
    this.stopButton.style.display = loading ? '' : 'none';
  }

  /** Replace the full set of note chips with the given files. */
  setNoteChips(files: TFile[]): void {
    if (!this.contextBar) return;

    // Remove chips that are no longer in the list.
    for (const [path] of this.noteChipMap) {
      if (!files.some((f) => f.path === path)) {
        this.removeOneChip(path);
      }
    }

    // Add chips for newly selected files (preserve existing ones).
    for (const file of files) {
      if (!this.noteChipMap.has(file.path)) {
        const chip = this.createChip(file);
        this.contextBar.appendChild(chip.element);
        this.noteChipMap.set(file.path, chip);
      }
    }
  }

  /** Remove a single chip by file path. */
  removeOneChip(path: string): void {
    const chip = this.noteChipMap.get(path);
    if (chip) {
      chip.removeButton.removeEventListener('click', chip.removeHandler);
      chip.element.remove();
      this.noteChipMap.delete(path);
    }
  }

  /** Remove all chips (e.g. after a message is sent). */
  clearNoteChips(): void {
    for (const path of [...this.noteChipMap.keys()]) {
      this.removeOneChip(path);
    }
    this.noteChipMap.clear();
  }

  /** Returns paths of all currently displayed chips. */
  getSelectedPaths(): string[] {
    return Array.from(this.noteChipMap.keys());
  }

  focus(): void {
    this.textarea?.focus();
  }

  destroy(): void {
    if (!this.wrapper) return;

    this.textarea?.removeEventListener('keydown', this.handleTextareaKeydown);
    this.textarea?.removeEventListener('input', this.handleTextareaInput);
    this.sendButton?.removeEventListener('click', this.handleSendClick);
    this.stopButton?.removeEventListener('click', this.handleStopClick);
    this.addCurrentNoteButton?.removeEventListener('click', this.handleAddCurrentNoteClick);
    this.noteAddButton?.removeEventListener('click', this.handleNoteAddClick);

    this.clearNoteChips();
    this.trailingAction?.remove();
    this.trailingAction = null;
    this.contextBar?.replaceChildren();
    this.wrapper.remove();
    this.callbacks = NOOP_CALLBACKS;
    this.textarea = null;
    this.sendButton = null;
    this.stopButton = null;
    this.addCurrentNoteButton = null;
    this.noteAddButton = null;
    this.contextBar = null;
    this.actionBar = null;
    this.wrapper = null;
  }

  private createChip(file: TFile): NoteChipEntry {
    const chip = document.createElement('span');
    chip.className = 'curraint-note-chip';

    const icon = document.createElement('span');
    icon.className = 'curraint-note-chip__icon';
    icon.textContent = '\uD83D\uDCC4';

    const label = document.createElement('span');
    label.className = 'curraint-note-chip__label';
    label.textContent = file.basename;

    const remove = document.createElement('button');
    remove.className = 'curraint-note-chip__remove';
    remove.textContent = '\u00D7';
    remove.title = 'Remove note from context';
    const removeHandler = (): void => {
      this.removeOneChip(file.path);
      this.callbacks.onNoteRemove(file.path);
    };
    remove.addEventListener('click', removeHandler);

    chip.appendChild(icon);
    chip.appendChild(label);
    chip.appendChild(remove);
    return { element: chip, removeButton: remove, removeHandler };
  }

  private trySubmit(): void {
    if (!this.textarea) return;

    const text = this.textarea.value.trim();
    if (!text) return;
    this.textarea.value = '';
    this.autoResize();
    this.callbacks.onSubmit(text);
  }

  private autoResize(): void {
    if (!this.textarea) return;

    this.textarea.style.height = 'auto';
    this.textarea.style.height = `${this.textarea.scrollHeight}px`;
  }

  private createButton(
    cls: string,
    text: string,
    title: string
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = cls;
    btn.textContent = text;
    btn.title = title;
    return btn;
  }
}

