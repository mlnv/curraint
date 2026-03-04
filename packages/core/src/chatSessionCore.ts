import type { ChatMessage } from './types';
import { debugLog } from './debugLog';

export type ChatSessionState = {
  conversation: ChatMessage[];
  status: string;
  isSending: boolean;
  isStopping: boolean;
};

export type ChatSessionTransport = {
  streamChat: (
    messages: ChatMessage[],
    onDelta: (delta: string) => void,
    options?: { signal?: AbortSignal }
  ) => Promise<string>;
  cancelChatStream?: () => Promise<void>;
  clearSession?: () => Promise<void>;
};

export type ChatSessionSubscriber = {
  onStateChange?: (state: ChatSessionState) => void;
  onDelta?: (delta: string) => void;
};

export type ChatSessionCore = {
  getState: () => ChatSessionState;
  subscribe: (subscriber: ChatSessionSubscriber) => () => void;
  submitPrompt: (content: string) => Promise<void>;
  editUserMessage: (index: number, editedContent: string) => Promise<void>;
  stopResponse: () => Promise<void>;
  clearConversation: () => void;
};

type MutableState = {
  conversation: ChatMessage[];
  status: string;
  isSending: boolean;
  isStopping: boolean;
};

function snapshotState(state: MutableState): ChatSessionState {
  return {
    conversation: [...state.conversation],
    status: state.status,
    isSending: state.isSending,
    isStopping: state.isStopping
  };
}

export function createChatSessionCore(transport: ChatSessionTransport): ChatSessionCore {
  const subscribers = new Set<ChatSessionSubscriber>();
  const state: MutableState = {
    conversation: [],
    status: '',
    isSending: false,
    isStopping: false
  };

  let isCancelling = false;
  let activeController: AbortController | null = null;

  const emitState = (): void => {
    const snapshot = snapshotState(state);
    for (const subscriber of subscribers) {
      subscriber.onStateChange?.(snapshot);
    }
  };

  const emitDelta = (delta: string): void => {
    for (const subscriber of subscribers) {
      subscriber.onDelta?.(delta);
    }
  };

  const setState = (next: Partial<MutableState>): void => {
    if (next.conversation) {
      state.conversation = next.conversation;
    }

    if (typeof next.status === 'string') {
      state.status = next.status;
    }

    if (typeof next.isSending === 'boolean') {
      state.isSending = next.isSending;
    }

    if (typeof next.isStopping === 'boolean') {
      state.isStopping = next.isStopping;
    }

    emitState();
  };

  const resendFromConversation = async (nextConversation: ChatMessage[]): Promise<void> => {
    const assistantIndex = nextConversation.length;
    setState({
      conversation: [...nextConversation, { role: 'assistant', content: '' }],
      status: 'Thinking...',
      isSending: true,
      isStopping: false
    });

    isCancelling = false;
    const controller = new AbortController();
    activeController = controller;

    // --- performance timing ---
    const _perfT0 = performance.now();
    let _perfFirstDelta = false;
    debugLog('PERF:renderer', 'streamChat call starting');

    try {
      const reply = await transport.streamChat(
        nextConversation,
        (delta) => {
          if (!delta) {
            return;
          }

          if (!_perfFirstDelta) {
            _perfFirstDelta = true;
            debugLog('PERF:renderer', `first delta received +${(performance.now() - _perfT0).toFixed(0)}ms since streamChat start`);
          }

          emitDelta(delta);
          setState({
            conversation: state.conversation.map((message, index) =>
              index === assistantIndex && message.role === 'assistant'
                ? { ...message, content: message.content + delta }
                : message
            )
          });
        },
        { signal: controller.signal }
      );

      debugLog('PERF:renderer', `streamChat resolved +${(performance.now() - _perfT0).toFixed(0)}ms total`);
      const trimmedReply = reply.trim();
      const assistant = state.conversation[assistantIndex];
      if (isCancelling && assistant?.role === 'assistant' && trimmedReply.length === 0) {
        setState({
          conversation: state.conversation.filter((_, index) => index !== assistantIndex),
          status: 'Response stopped'
        });
      } else {
        setState({
          conversation: state.conversation.map((message, index) =>
            index === assistantIndex && message.role === 'assistant'
              ? { ...message, content: reply }
              : message
          ),
          status: isCancelling ? 'Response stopped' : ''
        });
      }
    } catch (error) {
      const isAbortError =
        (error instanceof DOMException && error.name === 'AbortError') ||
        (error instanceof Error && error.name === 'AbortError');

      if (isCancelling || isAbortError) {
        const assistant = state.conversation[assistantIndex];
        if (assistant?.role === 'assistant' && assistant.content.trim().length === 0) {
          setState({
            conversation: state.conversation.filter((_, index) => index !== assistantIndex)
          });
        }

        setState({ status: 'Response stopped' });
      } else {
        setState({
          conversation: state.conversation.filter((_, index) => index !== assistantIndex),
          status: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } finally {
      activeController = null;
      isCancelling = false;
      setState({ isSending: false, isStopping: false });
    }
  };

  return {
    getState: () => snapshotState(state),
    subscribe: (subscriber) => {
      subscribers.add(subscriber);
      subscriber.onStateChange?.(snapshotState(state));

      return () => {
        subscribers.delete(subscriber);
      };
    },
    submitPrompt: async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || state.isSending) {
        return;
      }

      debugLog('PERF:renderer', 'submitPrompt called');
      const nextConversation = [...state.conversation, { role: 'user' as const, content: trimmed }];
      await resendFromConversation(nextConversation);
    },
    editUserMessage: async (index: number, editedContent: string) => {
      if (state.isSending) {
        return;
      }

      const trimmedContent = editedContent.trim();
      if (!trimmedContent) {
        return;
      }

      const target = state.conversation[index];
      if (!target || target.role !== 'user' || target.content === trimmedContent) {
        return;
      }

      const nextConversation = state.conversation
        .slice(0, index + 1)
        .map((message, messageIndex) =>
          messageIndex === index ? { ...message, content: trimmedContent } : message
        );

      await resendFromConversation(nextConversation);
    },
    stopResponse: async () => {
      if (!state.isSending || state.isStopping) {
        return;
      }

      isCancelling = true;
      setState({ isStopping: true, status: 'Stopping response...' });

      activeController?.abort();

      try {
        await transport.cancelChatStream?.();
      } catch {
        setState({ status: 'Failed to stop response' });
      }
    },
    clearConversation: () => {
      if (state.isSending) {
        return;
      }

      setState({ conversation: [], status: '' });
      void transport.clearSession?.();
    }
  };
}