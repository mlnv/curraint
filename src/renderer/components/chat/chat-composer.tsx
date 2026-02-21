import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';

type Props = {
  prompt: string;
  status: string;
  canSend: boolean;
  isSending: boolean;
  onPromptChange: (value: string) => void;
  onPromptKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
};

export function ChatComposer({
  prompt,
  status,
  canSend,
  isSending,
  onPromptChange,
  onPromptKeyDown
}: Props): React.JSX.Element {
  return (
    <>
      <Textarea
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
        onKeyDown={onPromptKeyDown}
        placeholder="Ask anything..."
        className="min-h-[68px]"
      />
      <div className="flex items-end justify-between gap-2">
        <p className="max-h-16 min-h-4 flex-1 overflow-y-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">
          {status}
        </p>
        <Button type="submit" size="sm" disabled={!canSend}>
          {isSending ? 'Sending...' : 'Send'}
        </Button>
      </div>
    </>
  );
}
