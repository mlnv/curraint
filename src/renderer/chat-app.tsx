import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage } from '../common/types';
import { ChatComposer } from './components/chat/chat-composer';
import { ChatMessageList } from './components/chat/chat-message-list';
import { Card } from './components/ui/card';
import { toErrorMessage } from './lib/errors';

export function ChatApp(): React.JSX.Element {
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [enableThinkTagFolding, setEnableThinkTagFolding] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const isCancellingRef = useRef(false);

  const canSend = useMemo(() => !isSending && prompt.trim().length > 0, [isSending, prompt]);
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

  const resendFromConversation = async (nextConversation: ChatMessage[]): Promise<void> => {
    const assistantIndex = nextConversation.length;
    setConversation([
      ...nextConversation,
      { role: 'assistant' as const, content: '' }
    ]);
    setStatus('Thinking...');
    setIsSending(true);
    setIsStopping(false);
    isCancellingRef.current = false;

    try {
      const reply = await window.flowai.chatStream(nextConversation, (delta) => {
        setConversation((prev) =>
          prev.map((message, index) =>
            index === assistantIndex && message.role === 'assistant'
              ? { ...message, content: message.content + delta }
              : message
          )
        );
      });

      setConversation((prev) => {
        const assistant = prev[assistantIndex];
        if (
          isCancellingRef.current &&
          assistant?.role === 'assistant' &&
          reply.trim().length === 0
        ) {
          return prev.filter((_, index) => index !== assistantIndex);
        }

        return prev.map((message, index) =>
          index === assistantIndex && message.role === 'assistant'
            ? { ...message, content: reply }
            : message
        );
      });

      setStatus(isCancellingRef.current ? 'Response stopped' : '');
    } catch (error) {
      if (isCancellingRef.current) {
        setConversation((prev) => {
          const assistant = prev[assistantIndex];
          if (assistant?.role === 'assistant' && assistant.content.trim().length === 0) {
            return prev.filter((_, index) => index !== assistantIndex);
          }

          return prev;
        });
        setStatus('Response stopped');
      } else {
        setConversation((prev) => prev.filter((_, index) => index !== assistantIndex));
        setStatus(toErrorMessage(error));
      }
    } finally {
      setIsSending(false);
      setIsStopping(false);
      isCancellingRef.current = false;
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const content = prompt.trim();
    if (!content || isSending) {
      return;
    }

    const nextConversation = [...conversation, { role: 'user' as const, content }];
    setPrompt('');
    await resendFromConversation(nextConversation);
  };

  const onEditUserMessage = (index: number, editedContent: string): void => {
    if (isSending) {
      return;
    }

    const trimmedContent = editedContent.trim();
    if (!trimmedContent) {
      return;
    }

    const target = conversation[index];
    if (!target || target.role !== 'user') {
      return;
    }

    if (target.content === trimmedContent) {
      return;
    }

    const nextConversation = conversation
      .slice(0, index + 1)
      .map((message, messageIndex) =>
        messageIndex === index ? { ...message, content: trimmedContent } : message
      );

    void resendFromConversation(nextConversation);
  };

  const onStopResponse = (): void => {
    if (!isSending || isStopping) {
      return;
    }

    isCancellingRef.current = true;
    setIsStopping(true);
    setStatus('Stopping response...');
    void window.flowai.cancelChatStream().catch(() => {
      setStatus('Failed to stop response');
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
        <div className="border-b px-4 py-3">
          <p className="text-sm font-medium">FlowAI</p>
          <p className="text-xs text-muted-foreground">Tray Chat</p>
        </div>

        <ChatMessageList
          messages={messages}
          isSending={isSending}
          enableThinkTagFolding={enableThinkTagFolding}
          containerRef={messagesContainerRef}
          onContainerScroll={onMessagesScroll}
          onEditUserMessage={onEditUserMessage}
        />

        <form onSubmit={onSubmit} className="space-y-2 border-t p-3">
          <ChatComposer
            prompt={prompt}
            status={status}
            canSend={canSend}
            isSending={isSending}
            isStopping={isStopping}
            onStop={onStopResponse}
            onPromptChange={setPrompt}
            onPromptKeyDown={onPromptKeyDown}
          />
        </form>
      </Card>
    </div>
  );
}
