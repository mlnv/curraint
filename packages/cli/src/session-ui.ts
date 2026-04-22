import { stdout as output } from 'node:process';
import { getContextUsage } from '@curraint/core';
import type { ChatMessage, ChatSessionCore, EndpointSettings } from '@curraint/core';
import { renderMarkdown } from './markdown';
import { c } from './theme';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export class SessionUI {
  private spinnerTimer: ReturnType<typeof setInterval> | null = null;
  private activeAssistantPrefixPrinted = false;

  subscribe(session: ChatSessionCore): void {
    session.subscribe({
      onStateChange: (state) => {
        if (state.isSending && !this.activeAssistantPrefixPrinted) {
          this.activeAssistantPrefixPrinted = true;
          this.startSpinner();
        }
      },
    });
  }

  resetTurnState(): void {
    this.activeAssistantPrefixPrinted = false;
  }

  printFinalAssistantIfNeeded(session: ChatSessionCore): void {
    this.stopSpinner();
    this.activeAssistantPrefixPrinted = false;

    const state = session.getState();
    const last = state.conversation[state.conversation.length - 1];
    const content = last?.role === 'assistant' ? last.content.trim() : '';

    if (content) {
      output.write(`${c.yellow}AI:${c.reset}\n`);
      output.write(renderMarkdown(content));
      output.write('\n');
      if (last.usage?.total_tokens) {
        output.write(`${c.dim}${c.cyan}  total tokens: ${last.usage.total_tokens}${c.reset}\n`);
      }
    }

    if (state.status) {
      output.write(`${c.dim}Status: ${state.status}${c.reset}\n`);
    }
  }

  printHistory(session: ChatSessionCore): void {
    const { conversation } = session.getState();
    if (!conversation.length) {
      output.write('No conversation history yet.\n');
      return;
    }

    conversation.forEach((message, index) => {
      if (index > 0) output.write('\n');
      if (message.role === 'assistant') {
        output.write(`${c.dim}${index + 1}.${c.reset} ${c.yellow}AI:${c.reset}\n`);
        output.write(renderMarkdown(message.content));
        output.write('\n');
      } else {
        output.write(`${c.dim}${index + 1}.${c.reset} ${c.green}You:${c.reset} ${message.content}\n`);
      }
    });
  }

  printContextUsage(session: ChatSessionCore, settings: EndpointSettings): void {
    const state = session.getState();
    const usage = getContextUsage(settings, state.conversation, state.compactedContext);
    output.write(
      `${c.dim}${c.cyan}Context:${c.reset} ${usage.percent}% ` +
      `${c.dim}(${usage.usedMessages}/${usage.maxMessages} messages, ` +
      `${usage.usedCharacters}/${usage.maxCharacters} chars)${c.reset}\n`
    );

    if (state.compactedContext) {
      output.write(
        `${c.dim}${c.cyan}  summarized for AI:${c.reset} ` +
        `${state.compactedContext.sourceMessageCount} older messages ` +
        `${c.dim}(${state.compactedContext.sourceCharacterCount} chars source)${c.reset}\n`
      );
    }
  }

  getUserMessageIndexes(conversation: ChatMessage[]): number[] {
    return conversation
      .map((msg, idx) => ({ msg, idx }))
      .filter(({ msg }) => msg.role === 'user')
      .map(({ idx }) => idx);
  }

  private startSpinner(): void {
    let idx = 0;
    output.write('\n');
    this.spinnerTimer = setInterval(() => {
      output.write(`\r${c.yellow}AI:${c.reset} ${c.dim}${SPINNER_FRAMES[idx++ % SPINNER_FRAMES.length]}${c.reset}`);
    }, 80);
  }

  private stopSpinner(): void {
    if (this.spinnerTimer !== null) {
      clearInterval(this.spinnerTimer);
      this.spinnerTimer = null;
      output.write('\r\x1b[K'); // erase spinner line
    }
  }
}
