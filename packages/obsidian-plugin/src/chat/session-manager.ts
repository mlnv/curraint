import {
  createChatSessionCore,
  generateSessionId,
  deriveTitle,
  saveSession,
} from '@curraint/core';
import type { ChatSessionCore, ChatSessionTransport, ChatMessage, SavedSession } from '@curraint/core';

export type TransportFactory = () => ChatSessionTransport;

export type ConversationSlot = {
  core: ChatSessionCore;
  sessionId: string | null;
  sessionCreatedAt: number;
  title: string | null;
  prevIsSending: boolean;
  unsubscribe: () => void;
};

const INITIAL_SLOT_KEY = '__new__';

/**
 * Manages multiple independent conversation slots. Each slot has its own
 * ChatSessionCore so conversations can stream in the background while the
 * user switches to a different conversation. Only the active slot drives the
 * visible UI; background slots auto-save and clean themselves up when done.
 */
export class ConversationRegistry {
  private readonly transportFactory: TransportFactory;
  private readonly getEnableSessionSaving: () => boolean;
  private readonly slots = new Map<string, ConversationSlot>();
  private _activeKey = INITIAL_SLOT_KEY;

  constructor(transportFactory: TransportFactory, getEnableSessionSaving: () => boolean) {
    this.transportFactory = transportFactory;
    this.getEnableSessionSaving = getEnableSessionSaving;
  }

  get activeKey(): string {
    return this._activeKey;
  }

  /** Create the initial slot. Must be called once after construction. */
  init(): void {
    const slot = this.createSlot(INITIAL_SLOT_KEY, null, 0);
    this.slots.set(INITIAL_SLOT_KEY, slot);
  }

  /** Return the active slot's core, creating the slot if it is missing. */
  getOrCreateActive(): ChatSessionCore {
    if (!this.slots.has(this._activeKey)) {
      const slot = this.createSlot(this._activeKey, null, 0);
      this.slots.set(this._activeKey, slot);
    }
    return this.slots.get(this._activeKey)!.core;
  }

  /** Return the active slot, or null if none exists. */
  getActiveSlot(): ConversationSlot | null {
    return this.slots.get(this._activeKey) ?? null;
  }

  /** Create a fresh idle conversation and make it the active slot. */
  newConversation(): void {
    const key = `conv-${Date.now()}`;
    const slot = this.createSlot(key, null, 0);
    this.slots.set(key, slot);
    this._activeKey = key;
  }

  /**
   * Activate a saved session. If the session is already streaming in the
   * background, re-attach the view to it without interrupting the stream.
   * Otherwise create a fresh idle slot and load the saved messages into it.
   */
  loadSession(saved: SavedSession): void {
    // Re-attach to a background slot that is still streaming this session.
    for (const [k, slot] of this.slots) {
      if (slot.sessionId === saved.id && slot.core.getState().isSending) {
        this._activeKey = k;
        return;
      }
    }

    // Replace a stale idle slot under the same key if one exists.
    const key = saved.id;
    const existing = this.slots.get(key);
    if (existing) {
      existing.unsubscribe();
      this.slots.delete(key);
    }

    const slot = this.createSlot(key, saved.id, saved.createdAt);
    slot.title = saved.title;
    this.slots.set(key, slot);
    this._activeKey = key;
    slot.core.loadConversation(saved.messages);
  }

  /** Stop the active slot's stream if it is sending. */
  stopActive(): void {
    void this.slots.get(this._activeKey)?.core.stopResponse();
  }

  /** Release all slots and their core subscriptions. */
  destroy(): void {
    for (const slot of this.slots.values()) {
      slot.unsubscribe();
    }
    this.slots.clear();
  }

  private autoSave(slot: ConversationSlot, messages: ChatMessage[]): void {
    if (!this.getEnableSessionSaving()) return;

    let msgs = messages.filter((m) => m.role !== 'system');
    // Strip a trailing empty assistant placeholder (present while still streaming).
    if (msgs[msgs.length - 1]?.role === 'assistant' && msgs[msgs.length - 1]!.content === '') {
      msgs = msgs.slice(0, -1);
    }
    if (!msgs.some((m) => m.role === 'user')) return;

    if (!slot.sessionId) {
      slot.sessionId = generateSessionId();
      slot.sessionCreatedAt = Date.now();
    }
    const firstUserContent = msgs.find((m) => m.role === 'user')!.content;
    if (!slot.title) {
      slot.title = deriveTitle(firstUserContent);
    }
    saveSession({
      id: slot.sessionId,
      title: slot.title,
      createdAt: slot.sessionCreatedAt,
      updatedAt: Date.now(),
      messages: msgs,
    });
  }

  private createSlot(
    key: string,
    sessionId: string | null,
    sessionCreatedAt: number
  ): ConversationSlot {
    const core = createChatSessionCore(this.transportFactory());
    const slot: ConversationSlot = {
      core,
      sessionId,
      sessionCreatedAt,
      title: null,
      prevIsSending: false,
      unsubscribe: () => {},
    };

    slot.unsubscribe = core.subscribe({
      onStateChange: (state) => {
        const wasSending = slot.prevIsSending;
        slot.prevIsSending = state.isSending;

        if (!wasSending && state.isSending) {
          // Save eagerly so the session appears in the list while streaming.
          this.autoSave(slot, state.conversation);
          return;
        }

        if (wasSending && !state.isSending) {
          this.autoSave(slot, state.conversation);
          // Background slots remove themselves once their stream finishes.
          if (key !== this._activeKey) {
            slot.unsubscribe();
            this.slots.delete(key);
          }
        }
      },
    });

    return slot;
  }
}
