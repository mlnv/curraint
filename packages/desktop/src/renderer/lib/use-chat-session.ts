import { useEffect, useMemo, useRef, useState } from 'react';
import { createChatSessionCore } from '@curraint/core';
import type { ChatMessage, SavedSession } from '@curraint/core';

export type UseChatSessionResult = {
  conversation: ChatMessage[];
  prompt: string;
  status: string;
  isSending: boolean;
  isStopping: boolean;
  canSend: boolean;
  setPrompt: (value: string) => void;
  submitPrompt: (content: string) => Promise<void>;
  editUserMessage: (index: number, editedContent: string) => void;
  stopResponse: () => void;
  clearConversation: () => Promise<void>;
  loadSession: (session: SavedSession) => void;
};

export function useChatSession(): UseChatSessionResult {
  const sessionRef = useRef(
    createChatSessionCore({
      streamChat: (messages, onDelta) => window.curraint.chatStream(messages, onDelta),
      cancelChatStream: () => window.curraint.cancelChatStream(),
      clearSession: () => window.curraint.clearChatSession()
    })
  );
  const [conversation, setConversation] = useState<ChatMessage[]>(
    sessionRef.current.getState().conversation
  );
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState(sessionRef.current.getState().status);
  const [isSending, setIsSending] = useState(sessionRef.current.getState().isSending);
  const [isStopping, setIsStopping] = useState(sessionRef.current.getState().isStopping);

  // Session saving state — kept in refs to avoid stale closures inside the
  // onStateChange subscriber without triggering re-renders.
  const enableSessionSavingRef = useRef(false);
  const currentSessionIdRef = useRef<string | null>(null);
  const currentSessionCreatedAtRef = useRef(0);
  const prevIsSendingRef = useRef(false);
  // A session load requested while a stream is in-flight is deferred here.
  const pendingSessionRef = useRef<SavedSession | null>(null);

  // Load the enableSessionSaving preference once on mount.
  useEffect(() => {
    void window.curraint.getSettings().then((s) => {
      if (s) enableSessionSavingRef.current = s.enableSessionSaving;
    }).catch(() => { /* non-fatal */ });
  }, []);

  // Keep the preference in sync when the user changes settings.
  useEffect(() => {
    return window.curraint.onSettingsChanged((s) => {
      if (s) enableSessionSavingRef.current = s.enableSessionSaving;
    });
  }, []);

  useEffect(() => {
    return sessionRef.current.subscribe({
      onStateChange: (nextState) => {
        const wasSending = prevIsSendingRef.current;
        prevIsSendingRef.current = nextState.isSending;

        if (wasSending && !nextState.isSending) {
          // Auto-save the just-completed session A.
          if (enableSessionSavingRef.current) {
            const msgs = nextState.conversation.filter((m) => m.role !== 'system');
            if (msgs.length > 0) {
              if (!currentSessionIdRef.current) {
                const rand = Math.floor(Math.random() * 0xffff)
                  .toString(16)
                  .padStart(4, '0');
                currentSessionIdRef.current = `${Date.now()}-${rand}`;
                currentSessionCreatedAtRef.current = Date.now();
              }
              const firstUser = msgs.find((m) => m.role === 'user')?.content ?? '';
              const title = firstUser.length > 60 ? firstUser.slice(0, 60) : firstUser;
              void window.curraint.saveSession({
                id: currentSessionIdRef.current,
                title,
                createdAt: currentSessionCreatedAtRef.current,
                updatedAt: Date.now(),
                messages: msgs
              });
            }
          }

          // If a session load was deferred while streaming, apply it now.
          // Set React state directly to session B's data so the user never
          // sees session A's final message — the switch is instantaneous.
          const pending = pendingSessionRef.current;
          if (pending) {
            pendingSessionRef.current = null;
            currentSessionIdRef.current = pending.id;
            currentSessionCreatedAtRef.current = pending.createdAt;
            setConversation(pending.messages);
            setStatus('');
            setIsSending(false);
            setIsStopping(false);
            // Sync the session core so future operations (edit, auto-save)
            // work against session B's messages.
            sessionRef.current.loadConversation(pending.messages);
            return;
          }
        }

        setConversation(nextState.conversation);
        setStatus(nextState.status);
        setIsSending(nextState.isSending);
        setIsStopping(nextState.isStopping);
      }
    });
  }, []);

  // Receive a session pushed from the sessions window via main process.
  // If a stream is in-flight, defer the load until it finishes.
  useEffect(() => {
    return window.curraint.onSessionLoad((session) => {
      if (prevIsSendingRef.current) {
        pendingSessionRef.current = session;
      } else {
        sessionRef.current.loadConversation(session.messages);
        currentSessionIdRef.current = session.id;
        currentSessionCreatedAtRef.current = session.createdAt;
      }
    });
  }, []);

  const canSend = useMemo(() => !isSending && prompt.trim().length > 0, [isSending, prompt]);

  const submitPrompt = async (content: string): Promise<void> => {
    if (isSending || !content.trim()) {
      return;
    }

    setPrompt('');
    await sessionRef.current.submitPrompt(content);
  };

  const editUserMessage = (index: number, editedContent: string): void => {
    void sessionRef.current.editUserMessage(index, editedContent);
  };

  const stopResponse = (): void => {
    void sessionRef.current.stopResponse();
  };

  const clearConversation = async (): Promise<void> => {
    currentSessionIdRef.current = null;
    return sessionRef.current.clearConversation();
  };

  const loadSession = (session: SavedSession): void => {
    sessionRef.current.loadConversation(session.messages);
    currentSessionIdRef.current = session.id;
    currentSessionCreatedAtRef.current = session.createdAt;
  };

  return {
    conversation,
    prompt,
    status,
    isSending,
    isStopping,
    canSend,
    setPrompt,
    submitPrompt,
    editUserMessage,
    stopResponse,
    clearConversation,
    loadSession
  };
}
