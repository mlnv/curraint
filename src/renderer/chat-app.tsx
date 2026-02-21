import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ChatComposer } from './components/chat/chat-composer';
import { ChatMessageList } from './components/chat/chat-message-list';
import { Card } from './components/ui/card';
import { Button } from './components/ui/button';
import { copyTextToClipboard } from './lib/clipboard';
import { useChatSession } from './lib/use-chat-session';

export function ChatApp(): React.JSX.Element {
  const {
    conversation,
    prompt,
    status,
    isSending,
    isStopping,
    canSend,
    lastAssistantMessage,
    setPrompt,
    submitPrompt,
    editUserMessage,
    stopResponse
  } = useChatSession();
  const [enableThinkTagFolding, setEnableThinkTagFolding] = useState(true);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [isLastAnswerCopied, setIsLastAnswerCopied] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  const messages = useMemo(
    () => conversation.filter((message) => message.role !== 'system'),
    [conversation]
  );

  useEffect(() => {
    window.flowai
      .getSettings()
      .then((settings) => {
        setEnableThinkTagFolding(settings.enableThinkTagFolding);
      })
      .catch(() => {
        setEnableThinkTagFolding(true);
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

  const onCopyLastAnswer = (): void => {
    if (!lastAssistantMessage) {
      return;
    }

    void copyTextToClipboard(lastAssistantMessage).then((ok) => {
      if (!ok) {
        return;
      }

      setIsLastAnswerCopied(true);
      window.setTimeout(() => setIsLastAnswerCopied(false), 1200);
    });
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
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <p className="text-sm font-medium">FlowAI</p>
            <p className="text-xs text-muted-foreground">Tray Chat</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onCopyLastAnswer}
            disabled={!lastAssistantMessage}
          >
            {isLastAnswerCopied ? 'Copied' : 'Copy last answer'}
          </Button>
        </div>

        <ChatMessageList
          messages={messages}
          isSending={isSending}
          enableThinkTagFolding={enableThinkTagFolding}
          containerRef={messagesContainerRef}
          onContainerScroll={onMessagesScroll}
          onEditUserMessage={editUserMessage}
        />

        <form onSubmit={onSubmit} className="space-y-2 border-t p-3">
          <ChatComposer
            prompt={prompt}
            status={status}
            canSend={canSend}
            isSending={isSending}
            isStopping={isStopping}
            onStop={stopResponse}
            onPromptChange={setPrompt}
            onPromptKeyDown={onPromptKeyDown}
          />
        </form>
      </Card>
    </div>
  );
}
