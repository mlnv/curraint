import {
  buildTruncationSummary,
  estimateMessageCost,
  truncateConversationForContext
} from '../context';
import type { ChatMessage } from '../types';
import { applyStateUpdate, createInitialState, emitStateChange, snapshotState } from './state';
import { runStream } from './stream';
import type { ChatSessionCore, ChatSessionSubscriber, ChatSessionTransport } from './types';

type ManualCompactionCandidate = {
  sourceMessages: ChatMessage[];
  summary: string;
  usedMessages: number;
  usedCharacters: number;
};

function pickManualCompactionCandidate(
  messages: ChatMessage[],
  limits: { maxMessages: number; maxCharacters: number }
): ManualCompactionCandidate | null {
  if (messages.length < 3) {
    return null;
  }

  const minimumKeptMessages = messages.length >= 4 ? 2 : 1;
  const maxSourceMessages = messages.length - minimumKeptMessages;
  const currentUsedMessages = messages.length;
  const currentUsedCharacters = messages.reduce(
    (total, message) => total + estimateMessageCost(message),
    0
  );
  let bestCandidate: ManualCompactionCandidate | null = null;

  for (let sourceMessageCount = 2; sourceMessageCount <= maxSourceMessages; sourceMessageCount += 1) {
    const sourceMessages = messages.slice(0, sourceMessageCount);
    const keptMessages = messages.slice(sourceMessageCount);
    const summary = buildTruncationSummary(sourceMessages);
    const summaryCharacterCount = estimateMessageCost({
      role: 'system',
      content: summary
    });
    const keptCharacterCount = keptMessages.reduce(
      (total, message) => total + estimateMessageCost(message),
      0
    );
    const usedMessages = keptMessages.length + 1;
    const usedCharacters = keptCharacterCount + summaryCharacterCount;
    const improvesUsage =
      usedMessages < currentUsedMessages || usedCharacters < currentUsedCharacters;

    if (
      !improvesUsage ||
      usedMessages > limits.maxMessages ||
      usedCharacters > limits.maxCharacters
    ) {
      continue;
    }

    if (
      !bestCandidate ||
      usedMessages < bestCandidate.usedMessages ||
      (usedMessages === bestCandidate.usedMessages &&
        usedCharacters < bestCandidate.usedCharacters)
    ) {
      bestCandidate = {
        sourceMessages,
        summary,
        usedMessages,
        usedCharacters
      };
    }
  }

  return bestCandidate;
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
      if (!trimmed || state.isSending) return;
      await resend([...state.conversation, { role: 'user', content: trimmed, timestamp: Date.now() }]);
    },
    editUserMessage: async (index, editedContent) => {
      if (state.isSending) return;
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
      if (state.isSending) return;
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
    compactContext: (limits) => {
      if (state.isSending) return false;
      const nonEmpty = state.conversation.filter((message) => message.content.trim().length > 0);
      const manualCandidate = pickManualCompactionCandidate(nonEmpty, limits);
      let sourceMessages: ChatMessage[];
      let summary: string;

      if (manualCandidate) {
        sourceMessages = manualCandidate.sourceMessages;
        summary = manualCandidate.summary;
      } else {
        const { keptMessages, summary: autoSummary } = truncateConversationForContext(nonEmpty, limits);
        if (!autoSummary) {
          return false;
        }

        sourceMessages = nonEmpty.slice(0, nonEmpty.length - keptMessages.length);
        summary = autoSummary;
      }

      const sourceCharacterCount = sourceMessages.reduce(
        (total, message) => total + estimateMessageCost(message),
        0
      );

      setState({
        compactedContext: {
          summary,
          sourceMessageCount: sourceMessages.length,
          sourceCharacterCount
        },
        status: ''
      });
      return true;
    },
    clearConversation: async () => {
      if (state.isSending) return;
      setState({ conversation: [], status: '', compactedContext: null });
      await transport.clearSession?.();
    },
    loadConversation: (messages, compactedContext = null) => {
      setState({ conversation: messages, status: '', compactedContext });
    }
  };
}
