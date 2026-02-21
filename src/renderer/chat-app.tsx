import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage } from '../common/types';
import { ChatComposer } from './components/chat/chat-composer';
import { ChatMessageList } from './components/chat/chat-message-list';
import { Card } from './components/ui/card';
import { toErrorMessage } from './lib/errors';

export function ChatApp(): React.JSX.Element {
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => !isSending && prompt.trim().length > 0, [isSending, prompt]);
  const messages = useMemo(
    () => conversation.filter((message) => message.role !== 'system'),
    [conversation]
  );

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [messages, isSending]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const content = prompt.trim();
    if (!content || isSending) {
      return;
    }

    const nextConversation = [...conversation, { role: 'user' as const, content }];
    setConversation(nextConversation);
    setPrompt('');
    setStatus('Thinking...');
    setIsSending(true);

    try {
      const reply = await window.flowai.chat(nextConversation);
      setConversation((prev) => [...prev, { role: 'assistant', content: reply }]);
      setStatus('');
    } catch (error) {
      setStatus(toErrorMessage(error));
    } finally {
      setIsSending(false);
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
      <Card className="flex h-full flex-col overflow-hidden">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-medium">FlowAI</p>
          <p className="text-xs text-muted-foreground">Tray Chat</p>
        </div>

        <ChatMessageList
          messages={messages}
          isSending={isSending}
          containerRef={messagesContainerRef}
        />

        <form onSubmit={onSubmit} className="space-y-2 border-t p-3">
          <ChatComposer
            prompt={prompt}
            status={status}
            canSend={canSend}
            isSending={isSending}
            onPromptChange={setPrompt}
            onPromptKeyDown={onPromptKeyDown}
          />
        </form>
      </Card>
    </div>
  );
}
