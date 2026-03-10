import { debugLog } from '../debug/log';
import type { ChatMessage } from '../types';
import { applyStateUpdate, emitDelta, emitStateChange } from './state';
import type { MutableState } from './state';
import type { ChatSessionSubscriber, ChatSessionTransport } from './types';

type StreamContext = {
  state: MutableState;
  subscribers: Set<ChatSessionSubscriber>;
  assistantIndex: number;
};

function setState(ctx: StreamContext, next: Partial<MutableState>): void {
  applyStateUpdate(ctx.state, next);
  emitStateChange(ctx.subscribers, ctx.state);
}

function handleDelta(ctx: StreamContext, delta: string): void {
  if (!delta) return;
  emitDelta(ctx.subscribers, delta);
  setState(ctx, {
    conversation: ctx.state.conversation.map((msg, i) =>
      i === ctx.assistantIndex && msg.role === 'assistant'
        ? { ...msg, content: msg.content + delta }
        : msg
    )
  });
}

function handleSuccess(ctx: StreamContext, reply: string, wasCancelling: boolean): void {
  const trimmedReply = reply.trim();
  const assistant = ctx.state.conversation[ctx.assistantIndex];
  if (wasCancelling && assistant?.role === 'assistant' && trimmedReply.length === 0) {
    setState(ctx, {
      conversation: ctx.state.conversation.filter((_, i) => i !== ctx.assistantIndex),
      status: 'Response stopped'
    });
    return;
  }
  setState(ctx, {
    conversation: ctx.state.conversation.map((msg, i) =>
      i === ctx.assistantIndex && msg.role === 'assistant' ? { ...msg, content: reply } : msg
    ),
    status: wasCancelling ? 'Response stopped' : ''
  });
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

function handleError(ctx: StreamContext, error: unknown, wasCancelling: boolean): void {
  if (wasCancelling || isAbortError(error)) {
    const assistant = ctx.state.conversation[ctx.assistantIndex];
    if (assistant?.role === 'assistant' && assistant.content.trim().length === 0) {
      setState(ctx, {
        conversation: ctx.state.conversation.filter((_, i) => i !== ctx.assistantIndex)
      });
    }
    setState(ctx, { status: 'Response stopped' });
  } else {
    setState(ctx, {
      conversation: ctx.state.conversation.filter((_, i) => i !== ctx.assistantIndex),
      status: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export async function runStream(
  state: MutableState,
  subscribers: Set<ChatSessionSubscriber>,
  transport: ChatSessionTransport,
  nextConversation: ChatMessage[],
  isCancelling: () => boolean,
  setController: (c: AbortController | null) => void
): Promise<void> {
  const assistantIndex = nextConversation.length;
  const controller = new AbortController();
  setController(controller);

  const ctx: StreamContext = { state, subscribers, assistantIndex };
  const t0 = performance.now();
  let firstDelta = false;

  applyStateUpdate(state, {
    conversation: [...nextConversation, { role: 'assistant', content: '', timestamp: Date.now() }],
    status: 'Thinking...',
    isSending: true,
    isStopping: false
  });
  emitStateChange(subscribers, state);
  debugLog('PERF:renderer', 'streamChat call starting');

  try {
    const reply = await transport.streamChat(
      nextConversation,
      (delta) => {
        if (!firstDelta) {
          firstDelta = true;
          debugLog('PERF:renderer', `first delta +${(performance.now() - t0).toFixed(0)}ms`);
        }
        handleDelta(ctx, delta);
      },
      { signal: controller.signal }
    );
    debugLog('PERF:renderer', `streamChat resolved +${(performance.now() - t0).toFixed(0)}ms`);
    handleSuccess(ctx, reply, isCancelling());
  } catch (error) {
    handleError(ctx, error, isCancelling());
  } finally {
    setController(null);
    applyStateUpdate(state, { isSending: false, isStopping: false });
    emitStateChange(subscribers, state);
  }
}
