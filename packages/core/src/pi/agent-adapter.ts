import { Agent } from '@earendil-works/pi-agent-core';
import type { AgentEvent, AgentMessage } from '@earendil-works/pi-agent-core';
import type { Message } from '@earendil-works/pi-ai';

import type { ChatMessage } from '../types';
import type { EndpointSettings } from '../settings/types';
import { composeConversation } from '../settings/composer';
import { debugLog } from '../debug/log';
import {
  createInitialState,
  snapshotState,
  applyStateUpdate,
  emitStateChange,
  emitDelta
} from '../chat/state';
import type { MutableState } from '../chat/state';
import type { ChatSessionCore, ChatSessionSubscriber } from '../chat/types';
import { curraintToPiMessages, piToCurraintMessages } from './message-mapper';
import { resolvePiModel, resolveApiKey } from './provider-registry';

export interface PiSessionSettings {
  endpoint: EndpointSettings;
}

function isLLMMessage(msg: AgentMessage): msg is Message {
  return msg.role === 'user' || msg.role === 'assistant' || msg.role === 'toolResult';
}

function defaultConvertToLlm(messages: AgentMessage[]): Message[] {
  return messages.filter(isLLMMessage);
}

function createContextTransformer(settings: EndpointSettings) {
  return async (messages: AgentMessage[], _signal?: AbortSignal): Promise<AgentMessage[]> => {
    if (settings.contextMaxMessages <= 0) {
      return messages;
    }

    const hasSystemMsg = messages.length > 0 && messages[0]?.role === 'system';

    const trimmed: AgentMessage[] = [];
    if (hasSystemMsg && settings.systemPrompt) {
      trimmed.push(messages[0]!);
    }

    const nonSystem = messages.filter(m => m.role !== 'system');
    const limit = Math.max(1, settings.contextMaxMessages);
    const slice = nonSystem.slice(-limit);
    trimmed.push(...slice);

    return trimmed;
  };
}

export function createPiChatSessionCore(settings: PiSessionSettings): ChatSessionCore {
  const subscribers = new Set<ChatSessionSubscriber>();
  const state = createInitialState();

  const { model } = resolvePiModel(settings.endpoint);

  const agent = new Agent({
    initialState: {
      model,
      systemPrompt: settings.endpoint.systemPrompt,
      thinkingLevel: 'off',
      messages: []
    },
    convertToLlm: defaultConvertToLlm,
    transformContext: createContextTransformer(settings.endpoint),
    getApiKey: async () => resolveApiKey(settings.endpoint)
  });

  let previousAssistantContent = '';

  const setState = (next: Partial<MutableState>) => {
    applyStateUpdate(state, next);
  };

  const notifyState = () => {
    emitStateChange(subscribers, state);
  };

  agent.subscribe((event: AgentEvent, _signal: AbortSignal) => {
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
          // Guard against duplicate: submitPrompt / edit / retry all push the
          // user message immediately so the UI shows it synchronously, then the
          // agent replays it via message_start.  Skip the agent-driven append
          // when the conversation already ends with a matching user message.
          const lastMsg = state.conversation[state.conversation.length - 1];
          if (lastMsg?.role === 'user' && lastMsg?.content === content) {
            break;
          }
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
          } else if (ae.type === 'text_start' || ae.type === 'thinking_start') {
            delta = undefined;
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
          const msgs = [...state.conversation];
          const lastIdx = msgs.length - 1;
          if (lastIdx >= 0 && msgs[lastIdx]!.role === 'assistant') {
            const content = event.message.content
              .map((c: any) => c.text ?? c.thinking ?? '')
              .join('');
            msgs[lastIdx] = {
              ...msgs[lastIdx]!,
              content,
              usage: event.message.usage
                ? {
                    prompt_tokens: event.message.usage.input,
                    completion_tokens: event.message.usage.output,
                    total_tokens: event.message.usage.totalTokens
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
          conversation: piToCurraintMessages(event.messages)
        });
        notifyState();
        break;
      }
    }
  });

  return {
    getState: () => snapshotState(state),

    subscribe: (subscriber) => {
      subscribers.add(subscriber);
      subscriber.onStateChange?.(snapshotState(state));
      return () => {
        subscribers.delete(subscriber);
      };
    },

    submitPrompt: async (content) => {
      const trimmed = content.trim();
      if (!trimmed || state.isSending) return;

      const userMsg: ChatMessage = {
        role: 'user',
        content: trimmed,
        timestamp: Date.now()
      };

      const updated = [...state.conversation, userMsg];
      setState({ conversation: updated });
      notifyState();

      try {
        await agent.prompt(trimmed);
      } catch (error) {
        debugLog('PERF:renderer', 'pi agent prompt failed', error);
      }
    },

    editUserMessage: async (index, editedContent) => {
      if (state.isSending) return;
      const trimmed = editedContent.trim();
      const target = state.conversation[index];
      if (!trimmed || !target || target.role !== 'user' || target.content === trimmed) return;

      const truncated = state.conversation.slice(0, index + 1).map((m, i) =>
        i === index ? { ...m, content: trimmed, timestamp: Date.now() } : m
      );

      agent.reset();
      agent.state.systemPrompt = settings.endpoint.systemPrompt;

      const piMessages = curraintToPiMessages(truncated.slice(0, -1));
      if (piMessages.length > 0) {
        agent.state.messages = piMessages;
      }

      setState({
        conversation: truncated,
        status: ''
      });
      notifyState();

      try {
        await agent.prompt(trimmed);
      } catch (error) {
        debugLog('PERF:renderer', 'pi agent edit failed', error);
      }
    },

    retryLastMessage: async () => {
      if (state.isSending) return;
      let lastUserIndex = -1;
      for (let i = state.conversation.length - 1; i >= 0; i--) {
        if (state.conversation[i]!.role === 'user') { lastUserIndex = i; break; }
      }
      if (lastUserIndex === -1) return;

      const userMsg = state.conversation[lastUserIndex]!;
      const truncated = state.conversation.slice(0, lastUserIndex + 1);

      agent.reset();
      agent.state.systemPrompt = settings.endpoint.systemPrompt;

      const piMessages = curraintToPiMessages(truncated.slice(0, -1));
      if (piMessages.length > 0) {
        agent.state.messages = piMessages;
      }

      setState({
        conversation: truncated,
        status: ''
      });
      notifyState();

      try {
        await agent.prompt(userMsg.content);
      } catch (error) {
        debugLog('PERF:renderer', 'pi agent retry failed', error);
      }
    },

    stopResponse: async () => {
      if (!state.isSending || state.isStopping) return;
      setState({ isStopping: true, status: 'Stopping response...' });
      notifyState();
      agent.abort();
    },

    clearConversation: async () => {
      if (state.isSending) return;
      agent.reset();
      agent.state.systemPrompt = settings.endpoint.systemPrompt;
      setState({ conversation: [], status: '' });
      notifyState();
    },

    loadConversation: (messages) => {
      agent.reset();
      agent.state.systemPrompt = settings.endpoint.systemPrompt;

      const userAssistMsgs = messages.filter(m => m.role !== 'system');
      const piMessages = curraintToPiMessages(userAssistMsgs);
      if (piMessages.length > 0) {
        agent.state.messages = piMessages;
      }

      setState({
        conversation: [...messages],
        status: ''
      });
      notifyState();
    }
  };
}
