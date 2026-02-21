import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ChatComposer } from './components/chat/chat-composer';
import { ChatMessageList } from './components/chat/chat-message-list';
import { Card } from './components/ui/card';
import { useChatSession } from './lib/use-chat-session';

export function ChatApp(): React.JSX.Element {
  const {
    conversation,
    prompt,
    status,
    isSending,
    isStopping,
    canSend,
    setPrompt,
    submitPrompt,
    editUserMessage,
    stopResponse
  } = useChatSession();
  const [enableThinkTagFolding, setEnableThinkTagFolding] = useState(true);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  const messages = useMemo(
    () => conversation.filter((message) => message.role !== 'system'),
    [conversation]
  );

  useEffect(() => {
    window.curraint
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
          <p className="text-sm font-medium">CurrAInt</p>
          <p className="text-xs text-muted-foreground">Tray Chat</p>
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
