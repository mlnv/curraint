import type { ChatMessage } from '../types';
import { applyStateUpdate, createInitialState, emitStateChange, snapshotState } from './state';
import { runStream } from './stream';
import type { ChatSessionCore, ChatSessionSubscriber, ChatSessionTransport } from './types';

export function createChatSessionCore(transport: ChatSessionTransport): ChatSessionCore {
  const subscribers = new Set<ChatSessionSubscriber>();
  const state = createInitialState();
  let _isCancelling = false;
  let _activeController: AbortController | null = null;

  const setState = (next: Parameters<typeof applyStateUpdate>[1]) => {
    applyStateUpdate(state, next);
    emitStateChange(subscribers, state);
  };

  const resend = (conv: ChatMessage[]) =>
    runStream(state, subscribers, transport, conv, () => _isCancelling, (c) => {
      _activeController = c;
      if (!c) _isCancelling = false;
    });

  return {
    getState: () => snapshotState(state),
    subscribe: (subscriber) => {
      subscribers.add(subscriber);
      subscriber.onStateChange?.(snapshotState(state));
      return () => subscribers.delete(subscriber);
    },
    submitPrompt: async (content) => {
      const trimmed = content.trim();
      if (!trimmed || state.isSending) return;
      await resend([...state.conversation, { role: 'user', content: trimmed, timestamp: Date.now() }]);
    },
    editUserMessage: async (index, editedContent) => {
      if (state.isSending) return;
      const trimmed = editedContent.trim();
      const target = state.conversation[index];
      if (!trimmed || !target || target.role !== 'user' || target.content === trimmed) return;
      const next = state.conversation
        .slice(0, index + 1)
        .map((m, i) => (i === index ? { ...m, content: trimmed, timestamp: Date.now() } : m));
      await resend(next);
    },
    stopResponse: async () => {
      if (!state.isSending || state.isStopping) return;
      _isCancelling = true;
      setState({ isStopping: true, status: 'Stopping response...' });
      _activeController?.abort();
      try {
        await transport.cancelChatStream?.();
      } catch {
        setState({ status: 'Failed to stop response' });
      }
    },
    clearConversation: async () => {
      if (state.isSending) return;
      setState({ conversation: [], status: '' });
      await transport.clearSession?.();
    },
    loadConversation: (messages) => {
      setState({ conversation: messages, status: '' });
    }
  };
}
