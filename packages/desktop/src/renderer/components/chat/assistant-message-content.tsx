import { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import {
  getUnclosedReasoningTagStart,
  hasThinkTag,
  parseThinkTags,
  stripLeadingReasoningTag
} from '@curraint/core';
import { copyTextToClipboard } from '../../lib/clipboard';
import { Button } from '../ui/button';

type Props = {
  content: string;
  enableThinkTagFolding: boolean;
};

type ThinkBlockProps = {
  content: string;
  isStreaming?: boolean;
};

type MarkdownContentProps = {
  content: string;
};

type CodeRendererProps = {
  className?: string;
  children?: React.ReactNode;
  [key: string]: unknown;
};

function MarkdownCodeBlock({ className, children }: CodeRendererProps): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLElement>(null);
  const language = className?.match(/language-(\S+)/)?.[1] ?? '';
  const isBlock = Boolean(className?.includes('language-'));

  if (!isBlock) {
    return <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{children}</code>;
  }

  const handleCopy = (): void => {
    const text = codeRef.current?.textContent ?? '';
    void copyTextToClipboard(text).then((ok) => {
      setCopied(ok);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="flex items-center justify-between border-b border-border bg-muted/60 px-3 py-1">
        <span className="font-mono text-[10px] text-muted-foreground">
          {language || 'code'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded px-2 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
        >
          {copied ? '✓ copied' : 'copy'}
        </button>
      </div>
      <pre className="overflow-x-auto bg-[hsl(var(--hljs-bg))] p-3 text-xs leading-relaxed">
        <code ref={codeRef} className={className}>{children}</code>
      </pre>
    </div>
  );
}

function MarkdownContent({ content }: MarkdownContentProps): React.JSX.Element {
  return (
    <div className="space-y-2 break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          h1: ({ children }) => <h1 className="text-lg font-semibold">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-semibold">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold">{children}</h3>,
          p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
          ul: ({ children }) => <ul className="ml-5 list-disc space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="ml-5 list-decimal space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 pl-3 text-muted-foreground">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
          th: ({ children }) => <th className="border px-2 py-1 text-left">{children}</th>,
          td: ({ children }) => <td className="border px-2 py-1 align-top">{children}</td>,
          code: ({ children, className }) => (
            <MarkdownCodeBlock className={className}>{children}</MarkdownCodeBlock>
          ),
          pre: ({ children }) => <>{children}</>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer" className="underline">
              {children}
            </a>
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function ThinkBlock({ content, isStreaming = false }: ThinkBlockProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-md border border-dashed bg-muted/40 p-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {isOpen ? 'Hide reasoning details' : 'Show reasoning details'}
      </Button>
      {isStreaming ? (
        <p className="mt-1 text-xs text-muted-foreground">Reasoning is still streaming…</p>
      ) : null}
      {isOpen ? (
        <div className="mt-2 text-xs text-muted-foreground">
          <MarkdownContent content={content} />
        </div>
      ) : null}
    </div>
  );
}

export function AssistantMessageContent({
  content,
  enableThinkTagFolding
}: Props): React.JSX.Element {
  if (!enableThinkTagFolding) {
    return <MarkdownContent content={content} />;
  }

  const unclosedTagStart = getUnclosedReasoningTagStart(content);
  const visibleContent = unclosedTagStart >= 0 ? content.slice(0, unclosedTagStart) : content;
  const streamingReasoningContent =
    unclosedTagStart >= 0 ? stripLeadingReasoningTag(content.slice(unclosedTagStart)) : null;

  if (!hasThinkTag(visibleContent)) {
    return (
      <div className="space-y-2">
        <MarkdownContent content={visibleContent} />
        {streamingReasoningContent !== null ? (
          <ThinkBlock content={streamingReasoningContent} isStreaming />
        ) : null}
      </div>
    );
  }

  const segments = parseThinkTags(visibleContent).filter(
    (segment) => segment.content.length > 0
  );

  return (
    <div className="space-y-2">
      {segments.map((segment, index) =>
        segment.type === 'text' ? (
          <MarkdownContent key={`text-${index}`} content={segment.content} />
        ) : (
          <ThinkBlock key={`think-${index}`} content={segment.content} />
        )
      )}
      {streamingReasoningContent !== null ? (
        <ThinkBlock content={streamingReasoningContent} isStreaming />
      ) : null}
    </div>
  );
}
