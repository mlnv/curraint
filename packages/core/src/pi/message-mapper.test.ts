import { describe, expect, it } from 'vitest';
import { curraintToPiMessages, piToCurraintMessages, extractPiAssistantContent, extractPiUsage } from './message-mapper';
import type { ChatMessage } from '../types';
import type { UserMessage, AssistantMessage, ToolResultMessage } from '@earendil-works/pi-ai';

describe('message-mapper', () => {
  describe('curraintToPiMessages', () => {
    it('converts a user message', () => {
      const msgs: ChatMessage[] = [
        { role: 'user', content: 'Hello', timestamp: 1000 }
      ];
      const result = curraintToPiMessages(msgs);

      expect(result).toHaveLength(1);
      const um = result[0] as UserMessage;
      expect(um.role).toBe('user');
      expect(um.content).toBe('Hello');
      expect(um.timestamp).toBe(1000);
    });

    it('converts an assistant message with usage', () => {
      const msgs: ChatMessage[] = [
        {
          role: 'assistant',
          content: 'Hi there',
          timestamp: 2000,
          usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 }
        }
      ];
      const result = curraintToPiMessages(msgs);

      expect(result).toHaveLength(1);
      const am = result[0] as AssistantMessage;
      expect(am.role).toBe('assistant');
      expect(am.content).toEqual([{ type: 'text', text: 'Hi there' }]);
      expect(am.timestamp).toBe(2000);
      expect(am.usage.totalTokens).toBe(8);
    });

    it('handles empty assistant content', () => {
      const msgs: ChatMessage[] = [
        { role: 'assistant', content: '', timestamp: 3000 }
      ];
      const result = curraintToPiMessages(msgs);

      expect(result).toHaveLength(1);
      const am = result[0] as AssistantMessage;
      expect(am.content).toEqual([]);
    });

    it('skips system messages', () => {
      const msgs: ChatMessage[] = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hi' }
      ];
      const result = curraintToPiMessages(msgs);

      expect(result).toHaveLength(1);
      expect(result[0]!.role).toBe('user');
    });

    it('converts multiple mixed messages', () => {
      const msgs: ChatMessage[] = [
        { role: 'user', content: 'Q1', timestamp: 1 },
        { role: 'assistant', content: 'A1', timestamp: 2 },
        { role: 'user', content: 'Q2', timestamp: 3 }
      ];
      const result = curraintToPiMessages(msgs);

      expect(result).toHaveLength(3);
      expect(result[0]!.role).toBe('user');
      expect(result[1]!.role).toBe('assistant');
      expect(result[2]!.role).toBe('user');
    });
  });

  describe('piToCurraintMessages', () => {
    it('converts a user message with string content', () => {
      const msgs = [
        { role: 'user' as const, content: 'Hello', timestamp: 1000 }
      ];
      const result = piToCurraintMessages(msgs);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ role: 'user', content: 'Hello', timestamp: 1000 });
    });

    it('converts a user message with array content', () => {
      const msgs = [
        {
          role: 'user' as const,
          content: [{ type: 'text', text: 'Hello world' }],
          timestamp: 1000
        }
      ];
      const result = piToCurraintMessages(msgs);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ role: 'user', content: 'Hello world', timestamp: 1000 });
    });

    it('converts an assistant message with text content', () => {
      const msgs: AssistantMessage[] = [
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Response' }],
          api: 'openai-completions',
          provider: 'openai',
          model: 'gpt-4o',
          usage: {
            input: 10,
            output: 5,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 15,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
          },
          stopReason: 'stop',
          timestamp: 2000
        }
      ];
      const result = piToCurraintMessages(msgs);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        role: 'assistant',
        content: 'Response',
        timestamp: 2000,
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      });
    });

    it('combines text and thinking into content string', () => {
      const msgs: AssistantMessage[] = [
        {
          role: 'assistant',
          content: [
            { type: 'thinking', thinking: 'Hmm...' },
            { type: 'text', text: 'Answer' }
          ],
          api: 'openai-completions',
          provider: 'openai',
          model: 'gpt-4o',
          usage: {
            input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
          },
          stopReason: 'stop',
          timestamp: 3000
        }
      ];
      const result = piToCurraintMessages(msgs);

      expect(result[0]!.content).toBe('Hmm...Answer');
    });

    it('skips toolResult messages', () => {
      const msgs = [
        { role: 'user' as const, content: 'Hi', timestamp: 1000 },
        { role: 'toolResult' as const, toolCallId: 'tc1', toolName: 'test', content: [], isError: false, timestamp: 2000 }
      ];
      const result = piToCurraintMessages(msgs);

      expect(result).toHaveLength(1);
      expect(result[0]!.role).toBe('user');
    });

    it('handles empty assistant content', () => {
      const msgs: AssistantMessage[] = [
        {
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
          timestamp: 4000
        }
      ];
      const result = piToCurraintMessages(msgs);

      expect(result[0]!.content).toBe('');
    });
  });

  describe('extractPiAssistantContent', () => {
    it('extracts text content', () => {
      const msg: AssistantMessage = {
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello' }],
        api: 'openai-completions',
        provider: 'openai',
        model: 'gpt-4o',
        usage: {
          input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
        },
        stopReason: 'stop',
        timestamp: 0
      };
      expect(extractPiAssistantContent(msg)).toBe('Hello');
    });

    it('extracts thinking content', () => {
      const msg: AssistantMessage = {
        role: 'assistant',
        content: [{ type: 'thinking', thinking: 'Let me think...' }],
        api: 'openai-completions',
        provider: 'openai',
        model: 'gpt-4o',
        usage: {
          input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
        },
        stopReason: 'stop',
        timestamp: 0
      };
      expect(extractPiAssistantContent(msg)).toBe('Let me think...');
    });
  });

  describe('extractPiUsage', () => {
    it('returns undefined when usage is absent', () => {
      const msg: AssistantMessage = {
        role: 'assistant',
        content: [],
        api: 'openai-completions',
        provider: 'openai',
        model: 'gpt-4o',
        usage: undefined as any,
        stopReason: 'stop',
        timestamp: 0
      };
      expect(extractPiUsage(msg)).toBeUndefined();
    });

    it('converts pi usage to curraint TokenUsage', () => {
      const msg: AssistantMessage = {
        role: 'assistant',
        content: [],
        api: 'openai-completions',
        provider: 'openai',
        model: 'gpt-4o',
        usage: {
          input: 100,
          output: 50,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 150,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
        },
        stopReason: 'stop',
        timestamp: 0
      };
      expect(extractPiUsage(msg)).toEqual({
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150
      });
    });
  });
});
