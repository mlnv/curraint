import type { ChatMessage } from '../types';
import type { ChatSessionState, ChatSessionSubscriber } from './types';

export type MutableState = {
  conversation: ChatMessage[];
  status: string;
  isSending: boolean;
  isStopping: boolean;
};

export function createInitialState(): MutableState {
  return { conversation: [], status: '', isSending: false, isStopping: false };
}

export function snapshotState(state: MutableState): ChatSessionState {
  return {
    conversation: [...state.conversation],
    status: state.status,
    isSending: state.isSending,
    isStopping: state.isStopping
  };
}

export function applyStateUpdate(state: MutableState, next: Partial<MutableState>): void {
  if (next.conversation) state.conversation = next.conversation;
  if (typeof next.status === 'string') state.status = next.status;
  if (typeof next.isSending === 'boolean') state.isSending = next.isSending;
  if (typeof next.isStopping === 'boolean') state.isStopping = next.isStopping;
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
