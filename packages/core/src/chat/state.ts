import type { CompactedContext } from '../context';
import type { ChatMessage } from '../types';
import type { ChatSessionState, ChatSessionSubscriber } from './types';

export type MutableState = {
  conversation: ChatMessage[];
  status: string;
  isSending: boolean;
  isStopping: boolean;
  isCompactingContext: boolean;
  compactedContext: CompactedContext | null;
};

export function createInitialState(): MutableState {
  return {
    conversation: [],
    status: '',
    isSending: false,
    isStopping: false,
    isCompactingContext: false,
    compactedContext: null
  };
}

export function snapshotState(state: MutableState): ChatSessionState {
  return {
    conversation: [...state.conversation],
    status: state.status,
    isSending: state.isSending,
    isStopping: state.isStopping,
    isCompactingContext: state.isCompactingContext,
    compactedContext: state.compactedContext ? { ...state.compactedContext } : null
  };
}

export function applyStateUpdate(state: MutableState, next: Partial<MutableState>): void {
  if (next.conversation) state.conversation = next.conversation;
  if (typeof next.status === 'string') state.status = next.status;
  if (typeof next.isSending === 'boolean') state.isSending = next.isSending;
  if (typeof next.isStopping === 'boolean') state.isStopping = next.isStopping;
  if (typeof next.isCompactingContext === 'boolean') state.isCompactingContext = next.isCompactingContext;
  if ('compactedContext' in next) state.compactedContext = next.compactedContext ?? null;
}

export function emitStateChange(
  subscribers: Set<ChatSessionSubscriber>,
  state: MutableState
): void {
  const snapshot = snapshotState(state);
  for (const subscriber of subscribers) subscriber.onStateChange?.(snapshot);
}

export function emitDelta(subscribers: Set<ChatSessionSubscriber>, delta: string): void {
  for (const subscriber of subscribers) subscriber.onDelta?.(delta);
}
