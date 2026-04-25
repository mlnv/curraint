import { useEffect, useMemo, useRef, useState } from 'react';
import { buildModelSummaryMessages, createChatSessionCore } from '@curraint/core';
import type { ChatMessage, CompactedContext, SavedSession } from '@curraint/core';

export type UseChatSessionResult = {
  conversation: ChatMessage[];
  compactedContext: CompactedContext | null;
  prompt: string;
  status: string;
  isSending: boolean;
  isStopping: boolean;
  isCompactingContext: boolean;
  canSend: boolean;
  totalTokens: number;
  setPrompt: (value: string) => void;
  submitPrompt: (content: string) => Promise<void>;
  editUserMessage: (index: number, editedContent: string) => void;
  retryLastMessage: () => void;
  stopResponse: () => void;
  summarizeContext: (limits: { maxMessages: number; maxCharacters: number }) => Promise<boolean>;
  clearConversation: () => Promise<void>;
  loadSession: (session: SavedSession) => void;
};

// Each session gets its own independent core instance. The UI always reflects
// whichever slot is currently "active". Background slots (e.g. a previous
// session still streaming after the user switched away) run to completion,
// auto-save, and clean themselves up without affecting the UI.
type SessionSlot = {
  core: ReturnType<typeof createChatSessionCore>;
  sessionId: string | null;
  sessionCreatedAt: number;
  prevIsSending: boolean;
  unsubscribe: () => void;
};

const INITIAL_SLOT_KEY = '__new__';

function makeSessionId(): string {
  const rand = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
  return `${Date.now()}-${rand}`;
}

export function useChatSession(): UseChatSessionResult {
  // Which slot's state is currently shown in the UI.
  const activeSlotKeyRef = useRef<string>(INITIAL_SLOT_KEY);
  // All live slots (active + any background streaming slots).
  const slotsRef = useRef<Map<string, SessionSlot>>(new Map());

  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [compactedContext, setCompactedContext] = useState<CompactedContext | null>(null);
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isCompactingContext, setIsCompactingContext] = useState(false);

  const enableSessionSavingRef = useRef(false);

  const autoSave = (
    slot: SessionSlot,
    messages: ChatMessage[],
    nextCompactedContext: CompactedContext | null
  ): void => {
    if (!enableSessionSavingRef.current) return;
    let msgs = messages.filter((m) => m.role !== 'system');
    // Strip the empty assistant placeholder that exists while the stream is
    // in flight — only save substantive content.
    if (msgs[msgs.length - 1]?.role === 'assistant' && msgs[msgs.length - 1].content === '') {
      msgs = msgs.slice(0, -1);
    }
    if (msgs.length === 0) return;
    if (!slot.sessionId) {
      slot.sessionId = makeSessionId();
      slot.sessionCreatedAt = Date.now();
    }
    const firstUser = msgs.find((m) => m.role === 'user')?.content ?? '';
    const title = firstUser.length > 60 ? firstUser.slice(0, 60) : firstUser;
    void window.curraint.saveSession({
      id: slot.sessionId,
      title,
      createdAt: slot.sessionCreatedAt,
      updatedAt: Date.now(),
      messages: msgs,
      compactedContext: nextCompactedContext
    });
  };

  const createSlot = (
    slotKey: string,
    sessionId: string | null,
    sessionCreatedAt: number
  ): SessionSlot => {
    const core = createChatSessionCore({
      summarizeMessages: async (messages) => window.curraint.summarizeMessages(
        buildModelSummaryMessages(messages)
      ),
      streamChat: (messages, onDelta, options) =>
        window.curraint.chatStream(messages, onDelta, options?.compactedContext),
      cancelChatStream: () => window.curraint.cancelChatStream(),
      clearSession: () => window.curraint.clearChatSession()
    });

    const slot: SessionSlot = {
      core,
      sessionId,
      sessionCreatedAt,
      prevIsSending: false,
      unsubscribe: () => {}
    };

    slot.unsubscribe = core.subscribe({
      onStateChange: (nextState) => {
        const wasSending = slot.prevIsSending;
        slot.prevIsSending = nextState.isSending;
        const isActive = slotKey === activeSlotKeyRef.current;

        if (!wasSending && nextState.isSending) {
          // Save as soon as the user message is added so the session
          // appears in the sessions list while the response is pending.
          autoSave(slot, nextState.conversation, nextState.compactedContext);
        }

        if (wasSending && !nextState.isSending) {
          autoSave(slot, nextState.conversation, nextState.compactedContext);
          if (!isActive) {
            // Background slot finished — unsubscribe and remove.
            slot.unsubscribe();
            slotsRef.current.delete(slotKey);
            return;
          }
        }

        if (isActive) {
          setConversation(nextState.conversation);
          setCompactedContext(nextState.compactedContext);
          setStatus(nextState.status);
          setIsSending(nextState.isSending);
          setIsStopping(nextState.isStopping);
          setIsCompactingContext(nextState.isCompactingContext);
        }
      }
    });

    return slot;
  };

  const switchToSession = (session: SavedSession): void => {
    const slotKey = session.id;
    let existing = slotsRef.current.get(slotKey);
    let existingKey = slotKey;

    // A background slot (e.g. INITIAL_SLOT_KEY) may have been auto-saved under
    // a generated sessionId that differs from its slot key.  Find it by sessionId
    // so we can switch back to the live stream instead of a stale snapshot.
    if (!existing) {
      for (const [key, slot] of slotsRef.current) {
        if (slot.sessionId === session.id && slot.core.getState().isSending) {
          existing = slot;
          existingKey = key;
          break;
        }
      }
    }

    if (existing?.core.getState().isSending) {
      // Already streaming in background — just switch the view to it.
      activeSlotKeyRef.current = existingKey;
      const state = existing.core.getState();
      setConversation(state.conversation);
      setCompactedContext(state.compactedContext);
      setStatus(state.status);
      setIsSending(state.isSending);
      setIsStopping(state.isStopping);
      setIsCompactingContext(state.isCompactingContext);
      return;
    }

    // Replace any stale idle slot and create a fresh one.
    if (existing) {
      existing.unsubscribe();
      slotsRef.current.delete(slotKey);
    }

    const slot = createSlot(slotKey, session.id, session.createdAt);
    slotsRef.current.set(slotKey, slot);

    // Reset all UI state immediately so switching away from a streaming session
    // never leaves stale messages or the waiting indicator visible.
    setConversation(session.messages);
    setCompactedContext(session.compactedContext ?? null);
    setIsSending(false);
    setIsStopping(false);
    setIsCompactingContext(false);
    setStatus('');

    // Activate BEFORE loadConversation so the resulting onStateChange
    // sees isActive=true and drives React state immediately.
    activeSlotKeyRef.current = slotKey;
    slot.core.loadConversation(session.messages, session.compactedContext ?? null);
  };

  // Create the initial slot once on mount.
  useEffect(() => {
    const slot = createSlot(INITIAL_SLOT_KEY, null, 0);
    slotsRef.current.set(INITIAL_SLOT_KEY, slot);

    return () => {
      for (const s of slotsRef.current.values()) s.unsubscribe();
      slotsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    void window.curraint.getSettings().then((s) => {
      if (s) enableSessionSavingRef.current = s.enableSessionSaving;
    }).catch(() => { /* non-fatal */ });
  }, []);

  useEffect(() => {
    return window.curraint.onSettingsChanged((s) => {
      if (s) enableSessionSavingRef.current = s.enableSessionSaving;
    });
  }, []);

  useEffect(() => {
    return window.curraint.onSessionLoad((session) => {
      switchToSession(session);
    });
  }, []);

  const activeSlot = (): SessionSlot | undefined =>
    slotsRef.current.get(activeSlotKeyRef.current);

  const canSend = useMemo(
    () => !isSending && !isCompactingContext && prompt.trim().length > 0,
    [isCompactingContext, isSending, prompt]
  );

  const totalTokens = useMemo(
    () => conversation.reduce((sum, m) => sum + (m.usage?.total_tokens ?? 0), 0),
    [conversation]
  );

  const submitPrompt = async (content: string): Promise<void> => {
    if (isSending || !content.trim()) return;
    setPrompt('');
    await activeSlot()?.core.submitPrompt(content);
  };

  const editUserMessage = (index: number, editedContent: string): void => {
    void activeSlot()?.core.editUserMessage(index, editedContent);
  };

  const retryLastMessage = (): void => {
    void activeSlot()?.core.retryLastMessage();
  };

  const stopResponse = (): void => {
    void activeSlot()?.core.stopResponse();
  };

  const clearConversation = async (): Promise<void> => {
    const slot = activeSlot();
    if (!slot) return;
    slot.sessionId = null;
    slot.sessionCreatedAt = 0;
    return slot.core.clearConversation();
  };

  const summarizeContext = async (limits: { maxMessages: number; maxCharacters: number }): Promise<boolean> => {
    const slot = activeSlot();
    if (!slot) {
      return false;
    }

    return slot.core.compactContext(limits);
  };

  const loadSession = (session: SavedSession): void => {
    switchToSession(session);
  };

  return {
    conversation,
    compactedContext,
    prompt,
    status,
    isSending,
    isStopping,
    isCompactingContext,
    canSend,
    totalTokens,
    setPrompt,
    submitPrompt,
    editUserMessage,
    retryLastMessage,
    stopResponse,
    summarizeContext,
    clearConversation,
    loadSession
  };
}
