import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { AgentEvent } from '@earendil-works/pi-agent-core';
import type { AgentMessage, AssistantMessage, UserMessage } from '@earendil-works/pi-ai';

import {
  createInitialState,
  snapshotState,
  applyStateUpdate,
  emitStateChange,
  emitDelta
} from '../chat/state';
import type { MutableState } from '../chat/state';
import type { ChatSessionSubscriber } from '../chat/types';

function makeSubscriber() {
  const stateChanges: any[] = [];
  const deltas: string[] = [];
  return {
    subscriber: {
      onStateChange: (s: any) => stateChanges.push(s),
      onDelta: (d: string) => deltas.push(d)
    },
    stateChanges,
    deltas
  };
}

function makeAssistantMsg(overrides: Partial<AssistantMessage> = {}): AssistantMessage {
  return {
    role: 'assistant',
    content: [],
    api: 'openai-completions',
    provider: 'openai',
    model: 'gpt-4o',
    usage: {
      input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
    },
    stopReason: 'stop',
    timestamp: Date.now(),
    ...overrides
  };
}

function makeUserMsg(content: string): UserMessage {
  return { role: 'user', content, timestamp: Date.now() };
}

type PiEventHandler = (event: AgentEvent, state: MutableState, subscribers: Set<ChatSessionSubscriber>) => void;

function createEventHandler(): PiEventHandler {
  let previousAssistantContent = '';

  return (event, state, subscribers) => {
    const setState = (next: Partial<MutableState>) => applyStateUpdate(state, next);
    const notifyState = () => emitStateChange(subscribers, state);

    switch (event.type) {
      case 'agent_start': {
        previousAssistantContent = '';
        setState({ isSending: true, isStopping: false, status: 'Thinking...' });
        notifyState();
        break;
      }

      case 'message_start': {
        if (event.message.role === 'assistant') {
          previousAssistantContent = '';
          setState({
            conversation: [
              ...state.conversation,
              { role: 'assistant', content: '', timestamp: Date.now() }
            ]
          });
          notifyState();
        } else if (event.message.role === 'user') {
          const content = typeof event.message.content === 'string'
            ? event.message.content
            : event.message.content.map((c: any) => c.text ?? '').join('');
          setState({
            conversation: [
              ...state.conversation,
              { role: 'user', content, timestamp: event.message.timestamp }
            ]
          });
          notifyState();
        }
        break;
      }

      case 'message_update': {
        if (event.message.role === 'assistant') {
          const ae = event.assistantMessageEvent;
          let delta: string | undefined;

          if (ae.type === 'text_delta') {
            delta = ae.delta;
          } else if (ae.type === 'thinking_delta') {
            delta = ae.delta;
          }

          if (delta) {
            emitDelta(subscribers, delta);
            const msgs = [...state.conversation];
            const lastIdx = msgs.length - 1;
            if (lastIdx >= 0 && msgs[lastIdx]!.role === 'assistant') {
              msgs[lastIdx] = {
                ...msgs[lastIdx]!,
                content: msgs[lastIdx]!.content + delta
              };
            }
            setState({ conversation: msgs });
            notifyState();
          }
        }
        break;
      }

      case 'message_end': {
        if (event.message.role === 'assistant') {
          const msg = event.message as AssistantMessage;
          const msgs = [...state.conversation];
          const lastIdx = msgs.length - 1;
          if (lastIdx >= 0 && msgs[lastIdx]!.role === 'assistant') {
            const content = msg.content
              .map((c: any) => c.text ?? c.thinking ?? '')
              .join('');
            msgs[lastIdx] = {
              ...msgs[lastIdx]!,
              content,
              usage: msg.usage
                ? {
                    prompt_tokens: msg.usage.input,
                    completion_tokens: msg.usage.output,
                    total_tokens: msg.usage.totalTokens
                  }
                : undefined
            };
          }
          setState({ conversation: msgs });
          notifyState();
        }
        break;
      }

      case 'agent_end': {
        setState({
          isSending: false,
          isStopping: false,
          status: '',
          conversation: event.messages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => {
              if (m.role === 'user') {
                return {
                  role: 'user' as const,
                  content: typeof m.content === 'string' ? m.content : m.content.map((c: any) => c.text ?? '').join(''),
                  timestamp: m.timestamp
                };
              }
              const am = m as AssistantMessage;
              return {
                role: 'assistant' as const,
                content: am.content.map((c: any) => c.text ?? c.thinking ?? '').join(''),
                timestamp: am.timestamp,
                usage: am.usage
                  ? { prompt_tokens: am.usage.input, completion_tokens: am.usage.output, total_tokens: am.usage.totalTokens }
                  : undefined
              };
            })
        });
        notifyState();
        break;
      }
    }
  };
}

describe('pi event handler', () => {
  let state: MutableState;
  let subscribers: Set<ChatSessionSubscriber>;
  let handler: PiEventHandler;
  let sub: ReturnType<typeof makeSubscriber>;

  beforeEach(() => {
    state = createInitialState();
    subscribers = new Set();
    handler = createEventHandler();
    sub = makeSubscriber();
    subscribers.add(sub.subscriber);
  });

  it('sets isSending on agent_start', () => {
    handler({ type: 'agent_start' }, state, subscribers);
    expect(state.isSending).toBe(true);
    expect(state.status).toBe('Thinking...');
    expect(sub.stateChanges).toHaveLength(1);
  });

  it('adds assistant placeholder on message_start for assistant', () => {
    handler({ type: 'agent_start' }, state, subscribers);
    sub.stateChanges = [];

    handler({
      type: 'message_start',
      message: makeAssistantMsg()
    }, state, subscribers);

    expect(state.conversation).toHaveLength(1);
    expect(state.conversation[0]!.role).toBe('assistant');
    expect(state.conversation[0]!.content).toBe('');
  });

  it('streams deltas on message_update', () => {
    handler({ type: 'agent_start' }, state, subscribers);
    sub.deltas.length = 0;

    handler({
      type: 'message_start',
      message: makeAssistantMsg()
    }, state, subscribers);

    handler({
      type: 'message_update',
      message: makeAssistantMsg({ content: [{ type: 'text', text: 'Hel' }] }),
      assistantMessageEvent: { type: 'text_delta', contentIndex: 0, delta: 'Hel' }
    } as any, state, subscribers);

    handler({
      type: 'message_update',
      message: makeAssistantMsg({ content: [{ type: 'text', text: 'Hello' }] }),
      assistantMessageEvent: { type: 'text_delta', contentIndex: 0, delta: 'lo' }
    } as any, state, subscribers);

    expect(sub.deltas).toEqual(['Hel', 'lo']);
    expect(state.conversation[0]!.content).toBe('Hello');
  });

  it('streams thinking deltas on message_update', () => {
    handler({ type: 'agent_start' }, state, subscribers);
    sub.deltas.length = 0;

    handler({
      type: 'message_start',
      message: makeAssistantMsg()
    }, state, subscribers);

    handler({
      type: 'message_update',
      message: makeAssistantMsg({ content: [{ type: 'thinking', thinking: 'Hmm' }] }),
      assistantMessageEvent: { type: 'thinking_delta', contentIndex: 0, delta: 'Hmm' }
    } as any, state, subscribers);

    expect(sub.deltas).toEqual(['Hmm']);
  });

  it('finalizes assistant content on message_end', () => {
    handler({ type: 'agent_start' }, state, subscribers);

    handler({
      type: 'message_start',
      message: makeAssistantMsg()
    }, state, subscribers);

    const finalMsg = makeAssistantMsg({
      content: [{ type: 'text', text: 'Final answer' }],
      usage: {
        input: 10, output: 5, cacheRead: 0, cacheWrite: 0, totalTokens: 15,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
      }
    });

    handler({ type: 'message_end', message: finalMsg }, state, subscribers);

    expect(state.conversation[0]!.content).toBe('Final answer');
    expect(state.conversation[0]!.usage).toEqual({
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15
    });
  });

  it('resets sending state on agent_end', () => {
    handler({ type: 'agent_start' }, state, subscribers);

    const msgs: AgentMessage[] = [
      makeUserMsg('Hi'),
      makeAssistantMsg({
        content: [{ type: 'text', text: 'Hello' }],
        usage: {
          input: 5, output: 3, cacheRead: 0, cacheWrite: 0, totalTokens: 8,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
        }
      })
    ];

    handler({ type: 'agent_end', messages: msgs }, state, subscribers);

    expect(state.isSending).toBe(false);
    expect(state.isStopping).toBe(false);
    expect(state.status).toBe('');
    expect(state.conversation).toEqual([
      { role: 'user', content: 'Hi', timestamp: expect.any(Number) },
      {
        role: 'assistant',
        content: 'Hello',
        timestamp: expect.any(Number),
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 }
      }
    ]);
  });

  it('handles message_start for user messages', () => {
    handler({
      type: 'message_start',
      message: makeUserMsg('Hello world')
    } as any, state, subscribers);

    expect(state.conversation).toHaveLength(1);
    expect(state.conversation[0]!.role).toBe('user');
    expect(state.conversation[0]!.content).toBe('Hello world');
  });
});
