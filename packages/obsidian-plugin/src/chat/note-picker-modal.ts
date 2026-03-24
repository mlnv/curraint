import { App, Modal, TFile } from 'obsidian';

const MAX_VISIBLE = 50;

export class NotePickerModal extends Modal {
  private readonly alreadySelected: ReadonlySet<string>;
  private readonly onConfirm: (files: TFile[]) => void;
  private checked: Set<string>;
  private allFiles: TFile[] = [];
  private listEl!: HTMLElement;
  private searchInput!: HTMLInputElement;
  private confirmBtn!: HTMLButtonElement;

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
    this.searchInput.addEventListener('input', () => this.renderList());

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
    cancelBtn.addEventListener('click', () => this.close());

    this.confirmBtn = footer.createEl('button', {
      text: 'Add to context',
      cls: 'mod-cta curraint-note-picker-modal__confirm',
    });
    this.confirmBtn.addEventListener('click', () => {
      const files = this.allFiles.filter((f) => this.checked.has(f.path));
      this.onConfirm(files);
      this.close();
    });

    this.updateConfirmLabel();

    // Focus search after the modal renders.
    window.setTimeout(() => this.searchInput.focus(), 0);
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private renderList(): void {
    const query = this.searchInput?.value.toLowerCase() ?? '';
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
        text: `\u2026 ${filtered.length - MAX_VISIBLE} more \u2014 refine the search to narrow results`,
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

    const item = this.listEl.createEl('li', {
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

    item.addEventListener('click', (e) => {
      if ((e.target as HTMLElement) !== checkbox) toggle();
    });
    checkbox.addEventListener('change', () => toggle());
  }

  private updateConfirmLabel(): void {
    if (!this.confirmBtn) return;
    const count = this.checked.size;
    this.confirmBtn.textContent =
      count > 0 ? `Add ${count} note${count === 1 ? '' : 's'} to context` : 'Add to context';
  }
}
