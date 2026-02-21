import { FormEvent, useMemo, useState } from 'react';
import type { ChatMessage } from '../common/types';
import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import { Textarea } from './components/ui/textarea';

type UiMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export function ChatApp(): React.JSX.Element {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState('');
  const [isSending, setIsSending] = useState(false);

  const canSend = useMemo(() => !isSending && prompt.trim().length > 0, [isSending, prompt]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const content = prompt.trim();
    if (!content || isSending) {
      return;
    }

    const nextHistory = [...history, { role: 'user' as const, content }];
    setHistory(nextHistory);
    setMessages((prev) => [...prev, { role: 'user', content }]);
    setPrompt('');
    setStatus('Thinking...');
    setIsSending(true);

    try {
      const reply = await window.flowai.chat(nextHistory);
      setHistory((prev) => [...prev, { role: 'assistant', content: reply }]);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      setStatus('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="h-screen bg-background p-3 text-foreground">
      <Card className="flex h-full flex-col overflow-hidden">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-medium">FlowAI</p>
          <p className="text-xs text-muted-foreground">Tray Chat</p>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-3">
          {messages.length === 0 ? (
            <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              Start typing to chat.
            </div>
          ) : null}

          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`max-w-[92%] rounded-md border px-3 py-2 text-sm leading-relaxed ${
                message.role === 'user'
                  ? 'ml-auto bg-muted'
                  : 'mr-auto bg-background'
              }`}
            >
              {message.content}
            </div>
          ))}
        </div>

        <form onSubmit={onSubmit} className="space-y-2 border-t p-3">
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ask anything..."
            className="min-h-[68px]"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-xs text-muted-foreground">{status}</p>
            <Button type="submit" size="sm" disabled={!canSend}>
              {isSending ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
