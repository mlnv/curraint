import { App, Modal, TFile } from 'obsidian';

const MAX_VISIBLE = 50;

export class NotePickerModal extends Modal {
  private readonly alreadySelected: ReadonlySet<string>;
  private readonly onConfirm: (files: TFile[]) => void;
  private checked: Set<string>;
  private allFiles: TFile[] = [];
  private listEl: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private confirmBtn: HTMLButtonElement | null = null;
  private focusTimeoutId: number | null = null;
  private readonly modalDisposers: Array<() => void> = [];
  private readonly listDisposers: Array<() => void> = [];

  constructor(
    app: App,
    alreadySelected: string[],
    onConfirm: (files: TFile[]) => void
  ) {
    super(app);
    this.alreadySelected = new Set(alreadySelected);
    this.checked = new Set(alreadySelected);
    this.onConfirm = onConfirm;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('curraint-note-picker-modal');

    contentEl.createEl('h2', { text: 'Add note context' });

    this.searchInput = contentEl.createEl('input', {
      cls: 'curraint-note-picker-modal__search',
      attr: { type: 'text', placeholder: 'Search notes\u2026', autocomplete: 'off' },
    });
    const handleSearchInput = (): void => {
      this.renderList();
    };
    this.searchInput.addEventListener('input', handleSearchInput);
    this.modalDisposers.push(() => {
      this.searchInput?.removeEventListener('input', handleSearchInput);
    });

    this.listEl = contentEl.createEl('ul', {
      cls: 'curraint-note-picker-modal__list',
    });

    this.allFiles = this.app.vault
      .getMarkdownFiles()
      .sort((a, b) => b.stat.mtime - a.stat.mtime);

    this.renderList();

    const footer = contentEl.createEl('div', {
      cls: 'curraint-note-picker-modal__footer',
    });

    const cancelBtn = footer.createEl('button', {
      text: 'Cancel',
      cls: 'curraint-note-picker-modal__cancel',
    });
    const handleCancelClick = (): void => {
      this.close();
    };
    cancelBtn.addEventListener('click', handleCancelClick);
    this.modalDisposers.push(() => {
      cancelBtn.removeEventListener('click', handleCancelClick);
    });

    this.confirmBtn = footer.createEl('button', {
      text: 'Add to context',
      cls: 'mod-cta curraint-note-picker-modal__confirm',
    });
    const handleConfirmClick = (): void => {
      const files = this.allFiles.filter((f) => this.checked.has(f.path));
      this.onConfirm(files);
      this.close();
    };
    this.confirmBtn.addEventListener('click', handleConfirmClick);
    this.modalDisposers.push(() => {
      this.confirmBtn?.removeEventListener('click', handleConfirmClick);
    });

    this.updateConfirmLabel();

    // Focus search after the modal renders.
    this.focusTimeoutId = window.setTimeout(() => this.searchInput?.focus(), 0);
  }

  onClose(): void {
    this.clearDisposers(this.listDisposers);
    this.clearDisposers(this.modalDisposers);
    if (this.focusTimeoutId !== null) {
      window.clearTimeout(this.focusTimeoutId);
      this.focusTimeoutId = null;
    }
    this.listEl = null;
    this.searchInput = null;
    this.confirmBtn = null;
    this.allFiles = [];
    this.contentEl.empty();
  }

  private renderList(): void {
    if (!this.listEl) return;

    const query = this.searchInput?.value.toLowerCase() ?? '';
    this.clearDisposers(this.listDisposers);
    this.listEl.empty();

    const filtered = query
      ? this.allFiles.filter((f) => f.path.toLowerCase().includes(query))
      : this.allFiles;

    const slice = filtered.slice(0, MAX_VISIBLE);

    for (const file of slice) {
      this.renderItem(file);
    }

    if (filtered.length > MAX_VISIBLE) {
      this.listEl.createEl('li', {
        text: `\u2026 ${filtered.length - MAX_VISIBLE} more - refine the search to narrow results`,
        cls: 'curraint-note-picker-modal__overflow',
      });
    }

    if (slice.length === 0) {
      this.listEl.createEl('li', {
        text: 'No notes match your search.',
        cls: 'curraint-note-picker-modal__empty',
      });
    }
  }

  private renderItem(file: TFile): void {
    const isChecked = this.checked.has(file.path);
    const listEl = this.listEl;
    if (!listEl) return;

    const item = listEl.createEl('li', {
      cls: 'curraint-note-picker-modal__item',
    });
    if (isChecked) item.addClass('is-checked');

    const checkbox = item.createEl('input', {
      cls: 'curraint-note-picker-modal__checkbox',
      attr: { type: 'checkbox' },
    }) as HTMLInputElement;
    checkbox.checked = isChecked;

    const labelEl = item.createEl('label', {
      cls: 'curraint-note-picker-modal__label',
    });

    labelEl.createEl('span', {
      text: file.basename,
      cls: 'curraint-note-picker-modal__basename',
    });

    const folder = file.parent?.path && file.parent.path !== '/'
      ? file.parent.path
      : '';
    if (folder) {
      labelEl.createEl('span', {
        text: folder,
        cls: 'curraint-note-picker-modal__folder',
      });
    }

    const toggle = (): void => {
      if (this.checked.has(file.path)) {
        this.checked.delete(file.path);
        checkbox.checked = false;
        item.removeClass('is-checked');
      } else {
        this.checked.add(file.path);
        checkbox.checked = true;
        item.addClass('is-checked');
      }
      this.updateConfirmLabel();
    };

    const handleItemClick = (event: MouseEvent): void => {
      if ((event.target as HTMLElement) !== checkbox) toggle();
    };
    const handleCheckboxChange = (): void => {
      toggle();
    };

    item.addEventListener('click', handleItemClick);
    checkbox.addEventListener('change', handleCheckboxChange);
    this.listDisposers.push(() => {
      item.removeEventListener('click', handleItemClick);
    });
    this.listDisposers.push(() => {
      checkbox.removeEventListener('change', handleCheckboxChange);
    });
  }

  private updateConfirmLabel(): void {
    if (!this.confirmBtn) return;
    const count = this.checked.size;
    this.confirmBtn.textContent =
      count > 0 ? `Add ${count} note${count === 1 ? '' : 's'} to context` : 'Add to context';
  }

  private clearDisposers(disposers: Array<() => void>): void {
    while (disposers.length > 0) {
      disposers.pop()?.();
    }
  }
}
