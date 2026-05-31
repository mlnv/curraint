import type { AgentMessage } from '@earendil-works/pi-agent-core';
import type { UserMessage, AssistantMessage, TextContent, ThinkingContent, ToolCall } from '@earendil-works/pi-ai';
import type { ChatMessage, TokenUsage } from '../types';

export function curraintToPiMessages(messages: ChatMessage[]): AgentMessage[] {
  const piMessages: AgentMessage[] = [];

  for (const msg of messages) {
    switch (msg.role) {
      case 'user': {
        const userMsg: UserMessage = {
          role: 'user',
          content: msg.content,
          timestamp: msg.timestamp ?? Date.now()
        };
        piMessages.push(userMsg);
        break;
      }
      case 'assistant': {
        const assistantMsg: AssistantMessage = {
          role: 'assistant',
          content: msg.content
            ? [{ type: 'text', text: msg.content }]
            : [],
          api: 'openai-completions',
          provider: 'openai',
          model: '',
          usage: {
            input: msg.usage?.prompt_tokens ?? 0,
            output: msg.usage?.completion_tokens ?? 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: msg.usage?.total_tokens ?? 0,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
          },
          stopReason: 'stop',
          timestamp: msg.timestamp ?? Date.now()
        };
        piMessages.push(assistantMsg);
        break;
      }
    }
  }

  return piMessages;
}

export function piToCurraintMessages(messages: AgentMessage[]): ChatMessage[] {
  const chatMessages: ChatMessage[] = [];

  for (const msg of messages) {
    if (msg.role === 'user') {
      const content = typeof msg.content === 'string'
        ? msg.content
        : (msg.content as Array<TextContent | { type: string; text?: string }>)
            .map((c: { type: string; text?: string }) => (c.type === 'text' ? (c.text ?? '') : ''))
            .join('');
      chatMessages.push({
        role: 'user',
        content,
        timestamp: msg.timestamp
      });
    } else if (msg.role === 'assistant') {
      const content = (msg.content as Array<TextContent | ThinkingContent | ToolCall>).map(
        (c: TextContent | ThinkingContent | ToolCall) => {
          if (c.type === 'text') return c.text;
          if (c.type === 'thinking') return c.thinking;
          if (c.type === 'toolCall') return '';
          return '';
        }
      ).join('');

      const usage: TokenUsage | undefined = msg.usage && msg.usage.totalTokens > 0
        ? {
            prompt_tokens: msg.usage.input,
            completion_tokens: msg.usage.output,
            total_tokens: msg.usage.totalTokens
          }
        : undefined;

      chatMessages.push({
        role: 'assistant',
        content,
        timestamp: msg.timestamp,
        usage
      });
    }
  }

  return chatMessages;
}

export function extractPiAssistantContent(msg: AssistantMessage): string {
  return (msg.content as Array<TextContent | ThinkingContent | ToolCall>).map(
    (c: TextContent | ThinkingContent | ToolCall) => {
      if (c.type === 'text') return c.text;
      if (c.type === 'thinking') return c.thinking;
      return '';
    }
  ).join('');
}

export function extractPiUsage(msg: AssistantMessage): TokenUsage | undefined {
  if (!msg.usage) return undefined;
  return {
    prompt_tokens: msg.usage.input,
    completion_tokens: msg.usage.output,
    total_tokens: msg.usage.totalTokens
  };
}
