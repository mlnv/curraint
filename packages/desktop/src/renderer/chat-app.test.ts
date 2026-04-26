// @vitest-environment jsdom
import { afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurraintApi } from '../ipc';
import { ChatApp } from './chat-app';

const { getContextUsageMock } = vi.hoisted(() => ({
  getContextUsageMock: vi.fn(),
}));

vi.mock('@curraint/core', () => ({
  getContextUsage: getContextUsageMock,
}));

vi.mock('./lib/use-chat-session', () => ({
  useChatSession: () => ({
    conversation: [],
    compactedContext: null,
    prompt: '',
    status: '',
    isSending: false,
    isStopping: false,
    isCompactingContext: false,
    canSend: true,
    totalTokens: 0,
    setPrompt: vi.fn(),
    submitPrompt: vi.fn(),
    editUserMessage: vi.fn(),
    retryLastMessage: vi.fn(),
    stopResponse: vi.fn(),
    summarizeContext: vi.fn().mockResolvedValue(false),
    clearConversation: vi.fn(),
  })
}));

vi.mock('./components/chat/chat-message-list', () => ({
  ChatMessageList: () => createElement('div', { 'data-testid': 'chat-message-list' })
}));

vi.mock('./components/ui/card', () => ({
  Card: ({ children }: { children: ReactNode }) => createElement('div', null, children)
}));

vi.mock('./lib/theme', () => ({
  applyTheme: vi.fn()
}));

beforeEach(() => {
  getContextUsageMock.mockReturnValue({
    percent: 42,
    tone: 'safe',
    usedMessages: 4,
    maxMessages: 10,
    usedCharacters: 400,
    maxCharacters: 1000,
    compactedMessages: 0,
    hasCompactedContext: false,
  });
  const mockApi: Partial<CurraintApi> = {
    getSettings: vi.fn().mockResolvedValue({ enableThinkTagFolding: true, theme: 'black' }),
    onSettingsChanged: vi.fn(() => () => undefined),
    onReceiveQuickInput: vi.fn(() => () => undefined),
    hideChatWindow: vi.fn().mockResolvedValue(undefined)
  };
  (window as { curraint: CurraintApi }).curraint = mockApi as CurraintApi;
});

afterEach(() => {
  cleanup();
});

describe('ChatApp context popup', () => {
  it('renders a hover bridge beneath the popup and keeps summarize reachable', async () => {
    const { container } = render(createElement(ChatApp));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Show context usage' })).not.toBeNull();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show context usage' }));
    expect(screen.getByText('Context budget')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Summarize older context' })).not.toBeNull();
    expect(container.querySelector('.curraint-chat-context-popup-bridge')).not.toBeNull();
  });

  it('shows compacted-context indicators when older messages were summarized', async () => {
    getContextUsageMock.mockReturnValue({
      percent: 42,
      tone: 'safe',
      usedMessages: 4,
      maxMessages: 10,
      usedCharacters: 400,
      maxCharacters: 1000,
      compactedMessages: 3,
      hasCompactedContext: true,
    });

    render(createElement(ChatApp));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Show context usage' })).not.toBeNull();
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Show context usage' })[0]!);

    expect(screen.getByText('3 older messages are already condensed into older context')).not.toBeNull();
  });
});