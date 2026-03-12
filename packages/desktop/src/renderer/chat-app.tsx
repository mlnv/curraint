import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ChatComposer } from './components/chat/chat-composer';
import { ChatMessageList } from './components/chat/chat-message-list';
import { Card } from './components/ui/card';
import { useChatSession } from './lib/use-chat-session';
import { applyTheme } from './lib/theme';

export function ChatApp(): React.JSX.Element {
  const {
    conversation,
    prompt,
    status,
    isSending,
    isStopping,
    canSend,
    totalTokens,
    setPrompt,
    submitPrompt,
    editUserMessage,
    retryLastMessage,
    stopResponse,
    clearConversation
  } = useChatSession();
  const [enableThinkTagFolding, setEnableThinkTagFolding] = useState(true);
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
        setEnableThinkTagFolding(settings.enableThinkTagFolding);
        applyTheme(settings.theme);
      })
      .catch(() => {
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
      setEnableThinkTagFolding(settings.enableThinkTagFolding);
      applyTheme(settings.theme);
    });
  }, []);

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
      <Card className="flex h-full flex-col overflow-hidden">
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

        <ChatMessageList
          messages={messages}
          isSending={isSending}
          enableThinkTagFolding={enableThinkTagFolding}
          containerRef={messagesContainerRef}
          onContainerScroll={onMessagesScroll}
          onEditUserMessage={editUserMessage}
          onRetryLastUserMessage={retryLastMessage}
        />

        {totalTokens > 0 ? (
          <div className="border-t px-4 py-1 text-right text-[10px] text-muted-foreground">
            {totalTokens.toLocaleString()} tokens this session
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-2 border-t p-3">
          <ChatComposer
            prompt={prompt}
            status={status}
            canSend={canSend}
            isSending={isSending}
            isStopping={isStopping}
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
