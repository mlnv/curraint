import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { getContextUsage } from '@curraint/core';
import { ChatComposer } from './components/chat/chat-composer';
import { ChatMessageList } from './components/chat/chat-message-list';
import { Card } from './components/ui/card';
import { useChatSession } from './lib/use-chat-session';
import { applyTheme } from './lib/theme';

export function ChatApp(): React.JSX.Element {
  const {
    conversation,
    compactedContext,
    prompt,
    status,
    isSending,
    isStopping,
    isCompactingContext,
    canSend,
    totalTokens,
    setPrompt,
    submitPrompt,
    editUserMessage,
    retryLastMessage,
    stopResponse,
    summarizeContext,
    clearConversation
  } = useChatSession();
  const [enableThinkTagFolding, setEnableThinkTagFolding] = useState(true);
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof window.curraint.getSettings>> | null>(null);
  const [contextActionMessage, setContextActionMessage] = useState('');
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);

  // Focus the composer whenever the window is shown / gains focus
  useEffect(() => {
    const onFocus = (): void => {
      promptRef.current?.focus();
    };
    window.addEventListener('focus', onFocus);
    // Also focus immediately on mount (initial open)
    promptRef.current?.focus();
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  // Hide the tray window on Escape via IPC (avoids close-event race on Windows)
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        void window.curraint.hideChatWindow();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const messages = useMemo(
    () => conversation.filter((message) => message.role !== 'system'),
    [conversation]
  );

  useEffect(() => {
    window.curraint
      .getSettings()
      .then((settings) => {
        if (!settings) return;
        setSettings(settings);
        setEnableThinkTagFolding(settings.enableThinkTagFolding);
        applyTheme(settings.theme);
      })
      .catch(() => {
        setSettings(null);
        setEnableThinkTagFolding(true);
      });
  }, []);

  useEffect(() => {
    return window.curraint.onReceiveQuickInput((message) => {
      // Await the session clear before streaming to prevent a race where
      // chatClear and chatStream IPC calls run concurrently in the main
      // process and destroy each other's Copilot sessions.
      void (async () => {
        await clearConversation();
        void submitPrompt(message);
      })();
    });
  }, [submitPrompt, clearConversation]);

  useEffect(() => {
    return window.curraint.onSettingsChanged((settings) => {
      if (!settings) return;
      setSettings(settings);
      setEnableThinkTagFolding(settings.enableThinkTagFolding);
      applyTheme(settings.theme);
    });
  }, []);

  const contextUsage = useMemo(() => {
    if (!settings) {
      return null;
    }

    return getContextUsage(settings, conversation, compactedContext);
  }, [settings, conversation, compactedContext]);

  const meterStroke = 2 * Math.PI * 18;
  const meterPercent = Math.max(0, Math.min(contextUsage?.percent ?? 0, 100));
  const meterOffset = meterStroke - (meterStroke * meterPercent) / 100;
  const meterTone =
    meterPercent >= 90
      ? 'text-rose-500'
      : meterPercent >= 70
        ? 'text-amber-500'
        : 'text-emerald-500';

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !shouldAutoScroll) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [messages, isSending, shouldAutoScroll]);

  const onMessagesScroll = (): void => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    setShouldAutoScroll(distanceFromBottom <= 48);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    await submitPrompt(prompt);
  };

  const onSummarizeContext = async (): Promise<void> => {
    if (!settings || isCompactingContext) {
      return;
    }

    setContextActionMessage('');

    try {
      const didSummarize = await summarizeContext({
        maxMessages: settings.contextMaxMessages,
        maxCharacters: settings.contextMaxCharacters
      });

      setContextActionMessage(
        didSummarize
          ? 'Older messages are now summarized for AI, while the transcript stays intact.'
          : 'There is not enough older context to compact yet.'
      );
    } catch (error) {
      setContextActionMessage(
        error instanceof Error
          ? error.message
          : 'Failed to summarize older context.'
      );
    }
  };

  const onPromptKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ): void => {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    event.preventDefault();
    if (!canSend) {
      return;
    }

    const form = event.currentTarget.form;
    if (form) {
      form.requestSubmit();
    }
  };

  return (
    <div className="h-screen bg-background p-3 text-foreground">
      <Card className="flex h-full flex-col overflow-visible">
        <div className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">curraint</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => { void window.curraint.openSessionsWindow(); }}
                className="rounded px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Browse sessions"
              >
                Sessions
              </button>
              {conversation.length > 0 && !isSending && (
                <button
                  type="button"
                  onClick={() => { void clearConversation(); }}
                  className="rounded px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="New chat"
                >
                  New chat
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <ChatMessageList
            messages={messages}
            isSending={isSending}
            enableThinkTagFolding={enableThinkTagFolding}
            containerRef={messagesContainerRef}
            onContainerScroll={onMessagesScroll}
            onEditUserMessage={editUserMessage}
            onRetryLastUserMessage={retryLastMessage}
          />
        </div>

        {totalTokens > 0 || contextUsage ? (
          <div className="flex items-center justify-between border-t px-4 py-1 text-[10px] text-muted-foreground">
            <span>
              {contextUsage
                ? `Context ${contextUsage.percent}% · ${contextUsage.usedMessages}/${contextUsage.maxMessages} msg · ${contextUsage.usedCharacters}/${contextUsage.maxCharacters} chars`
                : ''}
            </span>
            {totalTokens > 0 ? <span>{totalTokens.toLocaleString()} tokens this session</span> : <span />}
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-2 border-t p-3">
          <ChatComposer
            prompt={prompt}
            status={status}
            canSend={canSend}
            isSending={isSending}
            isStopping={isStopping}
            contextIndicator={
              contextUsage ? (
                <div className="group relative shrink-0">
                  <button
                    type="button"
                    className="relative flex h-8 w-8 items-center justify-center rounded-full border border-border/80 bg-background/70 text-[9px] font-semibold text-foreground shadow-sm transition hover:bg-muted"
                    title="Show context usage"
                    aria-label="Show context usage"
                  >
                    <svg className="absolute inset-0 h-8 w-8 -rotate-90" viewBox="0 0 40 40" aria-hidden="true">
                      <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/50" />
                      <circle
                        cx="20"
                        cy="20"
                        r="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={meterStroke}
                        strokeDashoffset={meterOffset}
                        className={meterTone}
                      />
                    </svg>
                    <span className="relative z-10">{contextUsage.percent}%</span>
                  </button>
                  <div className="invisible absolute bottom-full right-0 z-20 mb-2 w-72 rounded-2xl border border-border bg-background/95 p-3 text-left opacity-0 shadow-xl transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                    <div aria-hidden="true" className="curraint-chat-context-popup-bridge absolute right-0 top-full h-2 w-full" />
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Context budget
                    </p>
                    <p className="mt-2 text-sm text-foreground">
                      {contextUsage.percent}% of the active request budget is in use.
                    </p>
                    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                      <p>{contextUsage.usedMessages} / {contextUsage.maxMessages} composed messages</p>
                      <p>{contextUsage.usedCharacters} / {contextUsage.maxCharacters} composed characters</p>
                      <p>{contextUsage.hasCompactedContext ? `${contextUsage.compactedMessages} older messages are already condensed into older context` : 'No older context has been condensed yet'}</p>
                    </div>
                    {contextActionMessage ? (
                      <p className="mt-3 rounded-xl bg-muted px-3 py-2 text-xs text-foreground">
                        {contextActionMessage}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => { void onSummarizeContext(); }}
                      disabled={isCompactingContext}
                      className="mt-3 w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground"
                    >
                      {isCompactingContext ? 'Summarizing...' : 'Summarize older context'}
                    </button>
                  </div>
                </div>
              ) : null
            }
            textareaRef={promptRef}
            onStop={stopResponse}
            onPromptChange={setPrompt}
            onPromptKeyDown={onPromptKeyDown}
          />
        </form>
      </Card>
    </div>
  );
}
