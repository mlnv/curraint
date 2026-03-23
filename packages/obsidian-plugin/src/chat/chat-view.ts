import { ItemView, Notice, WorkspaceLeaf, setIcon } from 'obsidian';
import type CurraintPlugin from '../main';
import { buildTransport } from '../transport';
import { buildNoteContextMessage } from '../note-context';
import { ConversationRegistry } from './session-manager';
import { MessageRenderer } from './message-renderer';
import { InputBar } from './input-bar';
import { SessionsModal } from './sessions-modal';
import type { ChatMessage, ChatSessionCore, SavedSession } from '@curraint/core';

export const CHAT_VIEW_TYPE = 'curraint-chat';

export class ChatView extends ItemView {
  private readonly plugin: CurraintPlugin;
  private registry!: ConversationRegistry;
  private messageRenderer!: MessageRenderer;
  private inputBar!: InputBar;
  private noteContextActive = false;

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
    const root = this.containerEl.children[1] as HTMLElement;
    root.className = 'curraint-chat-view';

    const header = document.createElement('div');
    header.className = 'curraint-chat-header';

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
    header.appendChild(formatToggle);

    const newChatBtn = document.createElement('button');
    newChatBtn.className = 'curraint-chat-header__new-chat';
    newChatBtn.title = 'New conversation';
    newChatBtn.setAttribute('aria-label', 'New conversation');
    newChatBtn.textContent = 'Start a new conversation';
    newChatBtn.addEventListener('click', () => this.handleNewConversation());
    header.appendChild(newChatBtn);

    const sessionsBtn = document.createElement('button');
    sessionsBtn.className = 'curraint-chat-header__sessions';
    sessionsBtn.title = 'Browse saved conversations';
    sessionsBtn.setAttribute('aria-label', 'Browse saved conversations');
    sessionsBtn.textContent = 'Conversations';
    sessionsBtn.addEventListener('click', () => this.handleOpenSessions());
    header.appendChild(sessionsBtn);
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

    this.inputBar = new InputBar(inputEl, {
      onSubmit: (text) => { void this.handleSubmit(text); },
      onNoteToggle: (active) => { void this.handleNoteToggle(active); },
      onStop: () => { this.registry.stopActive(); },
    });

    this.inputBar.focus();
  }

  async onClose(): Promise<void> {
    this.registry.destroy();
  }

  async injectCurrentNote(): Promise<void> {
    const file = this.plugin.app.workspace.getActiveFile();
    if (!file) {
      new Notice('Curraint: No active note to add as context.');
      return;
    }
    this.noteContextActive = true;
    this.inputBar.setNoteActive(true, file.basename);
  }

  private handleNewConversation(): void {
    this.registry.newConversation();
    this.messageRenderer.renderAll([]);
    this.inputBar.setLoading(false);
    this.noteContextActive = false;
    this.inputBar.setNoteActive(false);
    this.inputBar.focus();
  }

  private handleNoteToggle(active: boolean): void {
    if (!active) {
      this.noteContextActive = false;
      return;
    }
    const file = this.plugin.app.workspace.getActiveFile();
    if (!file) {
      new Notice('Curraint: No active note to add as context.');
      this.inputBar.setNoteActive(false);
      return;
    }
    this.noteContextActive = true;
    this.inputBar.setNoteActive(true, file.basename);
  }

  private async handleSubmit(text: string): Promise<void> {
    const core = this.registry.getOrCreateActive();
    const submissionKey = this.registry.activeKey;
    const isThisConvActive = (): boolean => this.registry.activeKey === submissionKey;

    if (this.noteContextActive) {
      const noteMsg = await buildNoteContextMessage(this.plugin.app);
      if (noteMsg) {
        this.applyNoteContext(core, noteMsg);
      }
      this.noteContextActive = false;
      this.inputBar.setNoteActive(false);
    }

    // Guard: the user may have switched conversations during the async note build.
    if (!isThisConvActive()) return;

    this.messageRenderer.appendMessage('user', text);
    this.inputBar.setLoading(true);
    this.messageRenderer.beginAssistantMessage();

    let hasStarted = false;
    let hasUnlocked = false;
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
        if (!hasUnlocked && isThisConvActive()) {
          hasUnlocked = true;
          if (state.isStopping) {
            this.messageRenderer.cancelAssistantMessage();
          } else {
            this.messageRenderer.finalizeAssistantMessage();
          }
          this.inputBar.setLoading(false);
        }

        // Unsubscribe once the stream is truly done.
        if (!state.isSending) {
          unsubscribe?.();
        }
      },
    });

    try {
      await core.submitPrompt(text);
    } catch (err) {
      if (isThisConvActive() && !hasUnlocked) {
        hasUnlocked = true;
        this.messageRenderer.cancelAssistantMessage();
        this.inputBar.setLoading(false);
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
    this.renderActiveSlot();
    this.noteContextActive = false;
    this.inputBar.setNoteActive(false);
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
  }

  private applyNoteContext(core: ChatSessionCore, noteMsg: ChatMessage): void {
    const { conversation } = core.getState();
    const alreadyHasNoteContext =
      conversation[0]?.role === 'system' &&
      conversation[0]?.content.startsWith('The user has shared the following note');
    const base = alreadyHasNoteContext ? conversation.slice(1) : conversation;
    core.loadConversation([noteMsg, ...base]);
  }
}
