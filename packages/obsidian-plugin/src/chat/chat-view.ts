import { ItemView, Notice, WorkspaceLeaf, setIcon } from 'obsidian';
import type { TFile } from 'obsidian';
import type CurraintPlugin from '../main';
import { buildTransport } from '../transport';
import { buildNoteContextMessageForFile, NOTE_CONTEXT_PREFIX } from '../note-context';
import { ConversationRegistry } from './session-manager';
import { MessageRenderer } from './message-renderer';
import { InputBar } from './input-bar';
import { SessionsModal } from './sessions-modal';
import { NotePickerModal } from './note-picker-modal';
import { getContextUsage } from '@curraint/core';
import type { ChatMessage, ChatSessionCore, ChatSessionState, SavedSession } from '@curraint/core';

export const CHAT_VIEW_TYPE = 'curraint-chat';

export class ChatView extends ItemView {
  private readonly plugin: CurraintPlugin;
  private registry!: ConversationRegistry;
  private messageRenderer!: MessageRenderer;
  private inputBar!: InputBar;
  private pendingNoteFiles: TFile[] = [];
  private headerTitle!: HTMLInputElement;
  private contextMeterButton!: HTMLButtonElement;
  private contextMeterValue!: HTMLSpanElement;
  private contextPopupSummary!: HTMLParagraphElement;
  private contextPopupBreakdown!: HTMLDivElement;
  private contextPopupStatus!: HTMLParagraphElement;
  private contextStateUnsubscribe: (() => void) | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: CurraintPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return CHAT_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Curraint Chat';
  }

  getIcon(): string {
    return 'message-circle';
  }

  async onOpen(): Promise<void> {
    const root = this.resolveRootElement();
    root.classList.add('curraint-chat-view');

    const header = document.createElement('div');
    header.className = 'curraint-chat-header';
    header.appendChild(this.buildControls());

    this.headerTitle = this.buildTitleInput();
    header.appendChild(this.headerTitle);
    root.appendChild(header);

    const messagesEl = document.createElement('div');
    messagesEl.className = 'curraint-messages';
    root.appendChild(messagesEl);

    const inputEl = document.createElement('div');
    root.appendChild(inputEl);

    this.messageRenderer = new MessageRenderer(messagesEl, this.app, this);
    this.registry = new ConversationRegistry(
      () => buildTransport(this.plugin),
      () => this.plugin.settings.enableSessionSaving
    );
    this.registry.init();
    this.attachActiveContextListener();

    this.inputBar = new InputBar(inputEl, {
      onSubmit: (text) => { this.handleSubmit(text).catch(() => {}); },
      onAddCurrentNote: () => { this.injectCurrentNote(); },
      onNoteAdd: () => { this.handleOpenNotePicker(); },
      onNoteRemove: (path) => { this.handleNoteRemove(path); },
      onStop: () => { this.registry.stopActive(); },
    });

    // Keep the "+ <title>" button label in sync with the active note.
    const syncNoteTitle = (): void => {
      const file = this.plugin.app.workspace.getActiveFile();
      this.inputBar.setCurrentNoteTitle(file?.basename ?? null);
    };
    syncNoteTitle();
    this.registerEvent(
      this.plugin.app.workspace.on('active-leaf-change', syncNoteTitle)
    );
    // Also update when the active note is renamed.
    this.registerEvent(
      this.plugin.app.vault.on('rename', (file) => {
        if (file === this.plugin.app.workspace.getActiveFile()) {
          syncNoteTitle();
        }
      })
    );

    this.inputBar.focus();
    this.updateContextIndicator();
  }

  async onClose(): Promise<void> {
    this.inputBar?.destroy();
    this.pendingNoteFiles = [];
    this.contextStateUnsubscribe?.();
    this.contextStateUnsubscribe = null;
    this.destroyRegistry();
  }

  destroyRegistry(): void {
    this.registry?.destroy();
  }

  injectCurrentNote(): void {
    const file = this.plugin.app.workspace.getActiveFile();
    if (!file) {
      new Notice('Curraint: No active note to add as context.');
      return;
    }
    // Deduplicate: skip if this note is already in pending context.
    if (this.pendingNoteFiles.some((f) => f.path === file.path)) return;
    this.handleNotesConfirmed([...this.pendingNoteFiles, file]);
  }

  private handleNewConversation(): void {
    this.registry.newConversation();
    this.attachActiveContextListener();
    this.messageRenderer.renderAll([]);
    this.inputBar.setLoading(false);
    this.pendingNoteFiles = [];
    this.inputBar.clearNoteChips();
    this.updateHeaderTitle();
    this.contextPopupStatus.textContent = '';
    this.updateContextIndicator();
    this.inputBar.focus();
  }

  private handleOpenNotePicker(): void {
    new NotePickerModal(
      this.plugin.app,
      this.inputBar.getSelectedPaths(),
      (files) => { this.handleNotesConfirmed(files); }
    ).open();
  }

  private handleNotesConfirmed(files: TFile[]): void {
    this.pendingNoteFiles = files;
    this.inputBar.setNoteChips(files);
  }

  private handleNoteRemove(path: string): void {
    this.pendingNoteFiles = this.pendingNoteFiles.filter((f) => f.path !== path);
    // The chip is already removed by InputBar; no need to call removeOneChip again.
  }

  private async handleSubmit(text: string): Promise<void> {
    const core = this.registry.getOrCreateActive();
    const submissionKey = this.registry.activeKey;
    const isThisConvActive = (): boolean => this.registry.activeKey === submissionKey;

    let filesToInject: TFile[] = [];
    if (this.pendingNoteFiles.length > 0) {
      filesToInject = this.pendingNoteFiles.slice();
      this.pendingNoteFiles = [];
      this.inputBar.clearNoteChips();
      const noteMsgs = await Promise.all(
        filesToInject.map((f) => buildNoteContextMessageForFile(this.plugin.app, f))
      );
      const valid = noteMsgs.filter((m): m is ChatMessage => m !== null);
      if (valid.length > 0) {
        this.applyNoteContextAll(core, valid);
      }
    }

    // Guard: the user may have switched conversations during the async note build.
    if (!isThisConvActive()) return;

    const noteNames = filesToInject.length > 0 ? filesToInject.map((f) => f.basename) : undefined;
    this.messageRenderer.appendMessage('user', text, noteNames);
    this.inputBar.setLoading(true);
    this.messageRenderer.beginAssistantMessage();

    let hasStarted = false;
    const unlock = this.createUnlockOnce(isThisConvActive);
    let unsubscribe: () => void;
    unsubscribe = core.subscribe({
      onDelta: (delta: string) => {
        if (isThisConvActive()) this.messageRenderer.appendDelta(delta);
      },
      onStateChange: (state: { isSending: boolean; isStopping: boolean }) => {
        // Track when streaming genuinely begins (not the initial idle emission).
        if (state.isSending && !state.isStopping) { hasStarted = true; return; }
        if (!hasStarted) return;

        // Unlock the UI at the first sign that this response is ending.
        // This matters most for LM Studio: requestUrl cannot be aborted, so after
        // Stop is pressed isStopping goes true while isSending stays true until
        // the HTTP round-trip finishes. Unlocking here gives immediate feedback.
        unlock(state.isStopping);

        // Unsubscribe once the stream is truly done.
        if (!state.isSending) {
          unsubscribe?.();
        }
      },
    });

    try {
      await core.submitPrompt(text);
    } catch (err) {
      unlock(true);
      if (isThisConvActive()) {
        const message = err instanceof Error ? err.message : String(err);
        this.messageRenderer.showError(`Error: ${message}`);
        new Notice(`Curraint: ${message}`);
      }
      unsubscribe?.();
    }
  }

  private handleOpenSessions(): void {
    new SessionsModal(this.app, (session) => this.handleLoadSession(session)).open();
  }

  private handleLoadSession(saved: SavedSession): void {
    this.registry.loadSession(saved);
    this.attachActiveContextListener();
    this.renderActiveSlot();
    this.pendingNoteFiles = [];
    this.inputBar.clearNoteChips();
    this.updateHeaderTitle();
    this.contextPopupStatus.textContent = '';
    this.updateContextIndicator();
    this.inputBar.focus();
  }

  /**
   * Sync the renderer and input bar to whichever conversation is active.
   * If the slot is mid-stream, re-attach so future deltas flow into the view.
   */
  private renderActiveSlot(): void {
    const slot = this.registry.getActiveSlot();
    if (!slot) {
      this.messageRenderer.renderAll([]);
      this.inputBar.setLoading(false);
      this.updateContextIndicator();
      return;
    }
    const state = slot.core.getState();
    if (state.isSending) {
      const lastMsg = state.conversation[state.conversation.length - 1];
      const isStreamingAssistant = lastMsg?.role === 'assistant';
      const completeMsgs = isStreamingAssistant
        ? state.conversation.slice(0, -1)
        : state.conversation;
      const partialContent = isStreamingAssistant ? lastMsg.content : '';
      this.messageRenderer.renderAll(completeMsgs);
      this.messageRenderer.beginAssistantMessage(partialContent);
      this.inputBar.setLoading(true);
    } else {
      this.messageRenderer.renderAll(state.conversation);
      this.inputBar.setLoading(false);
    }
    this.updateContextIndicator(state);
  }

  private updateHeaderTitle(): void {
    if (!this.headerTitle) return;
    const slot = this.registry.getActiveSlot();
    this.headerTitle.value = slot?.title ?? '';
  }

  // Returns the header controls row (format toggle, new chat, sessions buttons).
  private buildControls(): HTMLElement {
    const controls = document.createElement('div');
    controls.className = 'curraint-chat-header__controls';

    const formatToggle = document.createElement('button');
    formatToggle.className = 'curraint-chat-header__format-toggle';
    formatToggle.title = 'Switch to plain text';
    formatToggle.setAttribute('aria-label', 'Switch to plain text');
    setIcon(formatToggle, 'pilcrow');
    formatToggle.addEventListener('click', () => {
      const plain = !this.messageRenderer.isPlainMode;
      this.messageRenderer.setPlainMode(plain);
      if (plain) {
        setIcon(formatToggle, 'code');
        formatToggle.title = 'Switch to formatted view';
        formatToggle.setAttribute('aria-label', 'Switch to formatted view');
      } else {
        setIcon(formatToggle, 'pilcrow');
        formatToggle.title = 'Switch to plain text';
        formatToggle.setAttribute('aria-label', 'Switch to plain text');
      }
    });
    controls.appendChild(formatToggle);

    const contextPopover = document.createElement('div');
    contextPopover.className = 'curraint-chat-header__context-popover';

    this.contextMeterButton = document.createElement('button');
    this.contextMeterButton.type = 'button';
    this.contextMeterButton.className = 'curraint-chat-header__context-meter';
    this.contextMeterButton.title = 'Show context usage';
    this.contextMeterButton.setAttribute('aria-label', 'Show context usage');

    this.contextMeterValue = document.createElement('span');
    this.contextMeterValue.className = 'curraint-chat-header__context-meter-value';
    this.contextMeterButton.appendChild(this.contextMeterValue);
    contextPopover.appendChild(this.contextMeterButton);

    const contextPopup = document.createElement('div');
    contextPopup.className = 'curraint-chat-header__context-popup';

    const contextLabel = document.createElement('p');
    contextLabel.className = 'curraint-chat-header__context-label';
    contextLabel.textContent = 'Context budget';
    contextPopup.appendChild(contextLabel);

    this.contextPopupSummary = document.createElement('p');
    this.contextPopupSummary.className = 'curraint-chat-header__context-summary';
    contextPopup.appendChild(this.contextPopupSummary);

    this.contextPopupBreakdown = document.createElement('div');
    this.contextPopupBreakdown.className = 'curraint-chat-header__context-breakdown';
    contextPopup.appendChild(this.contextPopupBreakdown);

    this.contextPopupStatus = document.createElement('p');
    this.contextPopupStatus.className = 'curraint-chat-header__context-status';
    contextPopup.appendChild(this.contextPopupStatus);

    const summarizeButton = document.createElement('button');
    summarizeButton.type = 'button';
    summarizeButton.className = 'curraint-chat-header__context-action';
    summarizeButton.textContent = 'Summarize older context';
    summarizeButton.addEventListener('click', () => this.handleSummarizeContext());
    contextPopup.appendChild(summarizeButton);

    contextPopover.appendChild(contextPopup);
    controls.appendChild(contextPopover);

    const newChatBtn = document.createElement('button');
    newChatBtn.className = 'curraint-chat-header__new-chat';
    newChatBtn.title = 'New conversation';
    newChatBtn.setAttribute('aria-label', 'New conversation');
    newChatBtn.textContent = 'Start a new conversation';
    newChatBtn.addEventListener('click', () => this.handleNewConversation());
    controls.appendChild(newChatBtn);

    const sessionsBtn = document.createElement('button');
    sessionsBtn.className = 'curraint-chat-header__sessions';
    sessionsBtn.title = 'Browse saved conversations';
    sessionsBtn.setAttribute('aria-label', 'Browse saved conversations');
    sessionsBtn.textContent = 'Conversations';
    sessionsBtn.addEventListener('click', () => this.handleOpenSessions());
    controls.appendChild(sessionsBtn);

    return controls;
  }

  // Returns the editable title input for the active conversation.
  private buildTitleInput(): HTMLInputElement {
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'curraint-chat-header__title';
    titleInput.placeholder = 'New conversation';
    titleInput.setAttribute('aria-label', 'Conversation title');
    titleInput.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') { titleInput.blur(); }
      if (e.key === 'Escape') {
        this.updateHeaderTitle();
        titleInput.blur();
      }
    });
    titleInput.addEventListener('blur', () => {
      this.registry.renameActive(titleInput.value);
      this.updateHeaderTitle();
    });
    return titleInput;
  }

  // Returns a function that unlocks the UI exactly once, regardless of how
  // many times it is called. When cancelled is true the streaming assistant
  // bubble is discarded; otherwise it is finalized with rendered content.
  private createUnlockOnce(isActive: () => boolean): (cancelled: boolean) => void {
    let done = false;
    return (cancelled: boolean): void => {
      if (done || !isActive()) { done = true; return; }
      done = true;
      if (cancelled) {
        this.messageRenderer.cancelAssistantMessage();
      } else {
        this.messageRenderer.finalizeAssistantMessage();
      }
      this.inputBar.setLoading(false);
      this.updateHeaderTitle();
      this.updateContextIndicator();
    };
  }

  private applyNoteContextAll(core: ChatSessionCore, noteMsgs: ChatMessage[]): void {
    const { conversation } = core.getState();
    // Replace only the current leading note context and preserve any later
    // note-context injections that are part of the actual conversation history.
    let base = conversation;
    while (
      base.length > 0 &&
      base[0].role === 'system' &&
      base[0].content.startsWith(NOTE_CONTEXT_PREFIX)
    ) {
      base = base.slice(1);
    }
    core.loadConversation([...noteMsgs, ...base], core.getState().compactedContext);
  }

  private attachActiveContextListener(): void {
    this.contextStateUnsubscribe?.();
    this.contextStateUnsubscribe = null;

    const slot = this.registry.getActiveSlot();
    if (!slot) {
      return;
    }

    this.contextStateUnsubscribe = slot.core.subscribe({
      onStateChange: (state) => this.updateContextIndicator(state)
    });
  }

  private updateContextIndicator(state?: ChatSessionState): void {
    if (!this.contextMeterButton) {
      return;
    }

    const currentState = state ?? this.registry.getActiveSlot()?.core.getState();
    const usage = getContextUsage(
      this.plugin.settings,
      currentState?.conversation ?? [],
      currentState?.compactedContext ?? null
    );
    const clampedPercent = Math.max(0, Math.min(usage.percent, 100));
    const tone = clampedPercent >= 90 ? 'danger' : clampedPercent >= 70 ? 'warn' : 'safe';

    this.contextMeterButton.style.setProperty('--curraint-context-progress', `${clampedPercent}%`);
    this.contextMeterButton.dataset.tone = tone;
    this.contextMeterValue.textContent = `${usage.percent}%`;
    this.contextPopupSummary.textContent = `${usage.percent}% of the active request budget is in use.`;
    this.contextPopupBreakdown.replaceChildren(
      this.createPopupLine(`${usage.usedMessages} / ${usage.maxMessages} composed messages`),
      this.createPopupLine(`${usage.usedCharacters} / ${usage.maxCharacters} composed characters`),
      this.createPopupLine(
        usage.hasCompactedContext
          ? `${usage.compactedMessages} older messages are already summarized for AI`
          : 'No hidden summary is active yet'
      )
    );
  }

  private createPopupLine(text: string): HTMLParagraphElement {
    const line = document.createElement('p');
    line.textContent = text;
    return line;
  }

  private handleSummarizeContext(): void {
    const slot = this.registry.getActiveSlot();
    if (!slot) {
      return;
    }

    const didCompact = slot.core.compactContext({
      maxMessages: this.plugin.settings.contextMaxMessages,
      maxCharacters: this.plugin.settings.contextMaxCharacters
    });
    this.contextPopupStatus.textContent = didCompact
      ? 'Older messages are now summarized for AI while the transcript stays visible.'
      : 'The current request already fits inside the active context limits.';
    this.updateContextIndicator();
  }

  private resolveRootElement(): HTMLElement {
    const indexedRoot = this.containerEl.children.item(1);
    if (indexedRoot instanceof HTMLElement) {
      return indexedRoot;
    }

    const fallbackRoot = this.containerEl.querySelector('.view-content');
    if (fallbackRoot instanceof HTMLElement) {
      console.warn('Curraint: Chat view root fallback used because containerEl.children[1] was unavailable.');
      return fallbackRoot;
    }

    const createdRoot = document.createElement('div');
    createdRoot.className = 'view-content';
    this.containerEl.appendChild(createdRoot);
    console.warn('Curraint: Chat view root was missing; created a fallback view-content container.');
    return createdRoot;
  }
}
