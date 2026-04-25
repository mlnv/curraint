import {
  estimateMessageCost,
} from '../context';
import type { ChatMessage } from '../types';
import { applyStateUpdate, createInitialState, emitStateChange, snapshotState } from './state';
import { runStream } from './stream';
import type { ChatSessionCore, ChatSessionSubscriber, ChatSessionTransport } from './types';

const MIN_MESSAGES_TO_KEEP = 1;
const MIN_MESSAGES_TO_KEEP_FOR_LONG_HISTORY = 2;
const LONG_HISTORY_THRESHOLD = 4;

type CompactionSelection = {
  sourceMessages: ChatMessage[];
  sourceMessageCount: number;
};

function getRequiredTailStartIndex(messages: ChatMessage[]): number {
  const minimumTailCount = messages.length >= LONG_HISTORY_THRESHOLD
    ? MIN_MESSAGES_TO_KEEP_FOR_LONG_HISTORY
    : MIN_MESSAGES_TO_KEEP;

  // Preserve the most recent user -> assistant turn when a full turn exists.
  if (messages[messages.length - 1]?.role === 'assistant') {
    for (let index = messages.length - 2; index >= 0; index -= 1) {
      if (messages[index]?.role === 'user') {
        return index;
      }
    }
  }

  return Math.max(messages.length - minimumTailCount, 0);
}

function pickManualCompactionSourceMessages(
  messages: ChatMessage[],
  limits: { maxMessages: number; maxCharacters: number },
): CompactionSelection | null {
  if (messages.length < 2) {
    return null;
  }

  const requiredTailStartIndex = getRequiredTailStartIndex(messages);
  let tailStartIndex = messages.length;
  let tailMessageCount = 0;
  let tailCharacterCount = 0;

  for (let index = messages.length - 1; index >= requiredTailStartIndex; index -= 1) {
    tailStartIndex = index;
    tailMessageCount += 1;
    tailCharacterCount += estimateMessageCost(messages[index]!);
  }

  for (let index = requiredTailStartIndex - 1; index >= 0; index -= 1) {
    const nextTailMessageCount = tailMessageCount + 1;
    const nextTailCharacterCount = tailCharacterCount + estimateMessageCost(messages[index]!);

    if (nextTailMessageCount > limits.maxMessages || nextTailCharacterCount > limits.maxCharacters) {
      break;
    }

    tailStartIndex = index;
    tailMessageCount = nextTailMessageCount;
    tailCharacterCount = nextTailCharacterCount;
  }

  if (tailStartIndex < 1) {
    return null;
  }

  return {
    sourceMessages: messages.slice(0, tailStartIndex),
    sourceMessageCount: tailStartIndex,
  };
}

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

  const clearCompactedContext = () => {
    if (!state.compactedContext) return;
    setState({ compactedContext: null });
  };

  return {
    getState: () => snapshotState(state),
    subscribe: (subscriber) => {
      subscribers.add(subscriber);
      subscriber.onStateChange?.(snapshotState(state));
      return () => subscribers.delete(subscriber);
    },
    submitPrompt: async (content) => {
      const trimmed = content.trim();
      if (!trimmed || state.isSending || state.isCompactingContext) return;
      await resend([...state.conversation, { role: 'user', content: trimmed, timestamp: Date.now() }]);
    },
    editUserMessage: async (index, editedContent) => {
      if (state.isSending || state.isCompactingContext) return;
      const trimmed = editedContent.trim();
      const target = state.conversation[index];
      if (!trimmed || !target || target.role !== 'user' || target.content === trimmed) return;
      if (state.compactedContext && index < state.compactedContext.sourceMessageCount) {
        clearCompactedContext();
      }
      const next = state.conversation
        .slice(0, index + 1)
        .map((m, i) => (i === index ? { ...m, content: trimmed, timestamp: Date.now() } : m));
      await resend(next);
    },
    retryLastMessage: async () => {
      if (state.isSending || state.isCompactingContext) return;
      let lastUserIndex = -1;
      for (let i = state.conversation.length - 1; i >= 0; i--) {
        if (state.conversation[i]!.role === 'user') { lastUserIndex = i; break; }
      }
      if (lastUserIndex === -1) return;
      await resend(state.conversation.slice(0, lastUserIndex + 1));
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
    compactContext: async (limits) => {
      if (state.isSending || state.isCompactingContext) return false;
      const nonEmptyEntries = state.conversation.flatMap((message, index) => (
        message.content.trim().length > 0
          ? [{ index, message }]
          : []
      ));
      const nonEmpty = nonEmptyEntries.map((entry) => entry.message);
      const selection = pickManualCompactionSourceMessages(nonEmpty, limits);
      if (!selection) {
        return false;
      }
      const { sourceMessages, sourceMessageCount: nonEmptySourceMessageCount } = selection;
      const sourceMessageCount = nonEmptyEntries[nonEmptySourceMessageCount - 1]!.index + 1;

      const sourceCharacterCount = sourceMessages.reduce(
        (total, message) => total + estimateMessageCost(message),
        0
      );

      setState({ isCompactingContext: true, status: 'Summarizing older context...' });

      try {
        const summary = (await transport.summarizeMessages(sourceMessages)).trim();
        if (!summary) {
          throw new Error('Summary request returned an empty response.');
        }

        const summaryCharacterCount = estimateMessageCost({
          role: 'system',
          content: summary
        });
        if (sourceMessages.length === 1 && summaryCharacterCount >= sourceCharacterCount) {
          setState({ status: '' });
          return false;
        }

        setState({
          compactedContext: {
            summary,
            sourceMessageCount,
            sourceCharacterCount
          },
          status: ''
        });
        return true;
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : 'Failed to summarize older context.';
        setState({ status: message });
        throw error instanceof Error ? error : new Error(message);
      } finally {
        setState({ isCompactingContext: false });
      }
    },
    clearConversation: async () => {
      if (state.isSending || state.isCompactingContext) return;
      setState({ conversation: [], status: '', compactedContext: null });
      await transport.clearSession?.();
    },
    loadConversation: (messages, compactedContext = null) => {
      setState({ conversation: messages, status: '', compactedContext });
    }
  };
}
