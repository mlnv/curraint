import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { createChatSessionCore } from '../common/chatSessionCore';
import { composeConversation, normalizeSettings } from '../common/settings';
import { isProviderId, requiresApiKeyForProvider } from '../common/providers';
import type { ChatMessage, EndpointSettings } from '../common/types';
import {
  chatCompletion,
  chatCompletionStream
} from '../common/openaiCompatibleClient';

function envSettings(): EndpointSettings {
  const providerCandidate = process.env.CURRAINT_PROVIDER;

  return normalizeSettings({
    provider: providerCandidate && isProviderId(providerCandidate)
      ? providerCandidate
      : undefined,
    apiKey: process.env.CURRAINT_API_KEY,
    baseUrl: process.env.CURRAINT_BASE_URL,
    model: process.env.CURRAINT_MODEL,
    systemPrompt: process.env.CURRAINT_SYSTEM_PROMPT
  });
}

async function run(): Promise<number> {
  const settings = envSettings();

  if (requiresApiKeyForProvider(settings.provider) && !settings.apiKey) {
    output.write('Missing CURRAINT_API_KEY.\n');
    return 1;
  }

  const rl = readline.createInterface({ input, output });
  const session = createChatSessionCore({
    streamChat: async (messages, onDelta, options) => {
      const composed = composeConversation(settings, messages);
      let hasStreamedChunk = false;
      let streamedMessage = '';

      try {
        const streamed = await chatCompletionStream(
          settings,
          composed,
          {
            onDelta: (delta) => {
              hasStreamedChunk = true;
              streamedMessage += delta;
              onDelta(delta);
            }
          },
          {
            signal: options?.signal
          }
        );

        return streamed.message;
      } catch (error) {
        const isAbortError =
          (error instanceof DOMException && error.name === 'AbortError') ||
          (error instanceof Error && error.name === 'AbortError');

        if (isAbortError) {
          return streamedMessage;
        }

        if (hasStreamedChunk) {
          throw error;
        }

        const fallback = await chatCompletion(settings, composed);
        return fallback.message;
      }
    }
  });
  let deltaPrintedForTurn = false;
  let activeAssistantPrefixPrinted = false;

  session.subscribe({
    onDelta: (delta) => {
      deltaPrintedForTurn = true;
      if (!activeAssistantPrefixPrinted) {
        output.write('AI: ');
        activeAssistantPrefixPrinted = true;
      }

      output.write(delta);
    }
  });

  output.write('CurrAInt CLI chat. Type "exit" to quit. Use /help for commands.\n');

  process.on('SIGINT', () => {
    if (session.getState().isSending) {
      void session.stopResponse();
      return;
    }

    output.write('\n');
    rl.close();
    process.exit(0);
  });

  const printFinalAssistantIfNeeded = (): void => {
    const current = session.getState();
    if (activeAssistantPrefixPrinted) {
      output.write('\n');
      activeAssistantPrefixPrinted = false;
    }

    const last = current.conversation[current.conversation.length - 1];
    if (!deltaPrintedForTurn && last?.role === 'assistant' && last.content.trim()) {
      output.write(`AI: ${last.content}\n`);
    }

    if (current.status) {
      output.write(`Status: ${current.status}\n`);
    }
  };

  const getUserMessageIndexes = (conversation: ChatMessage[]): number[] => {
    const indexes: number[] = [];
    conversation.forEach((message, index) => {
      if (message.role === 'user') {
        indexes.push(index);
      }
    });

    return indexes;
  };

  const printHistory = (): void => {
    const { conversation } = session.getState();
    if (!conversation.length) {
      output.write('No conversation history yet.\n');
      return;
    }

    conversation.forEach((message, index) => {
      const label = message.role === 'assistant' ? 'AI' : 'You';
      output.write(`${index + 1}. ${label}: ${message.content}\n`);
    });
  };

  try {
    while (true) {
      const text = (await rl.question('You: ')).trim();
      if (!text) {
        continue;
      }

      if (text.toLowerCase() === 'exit' || text.toLowerCase() === 'quit') {
        break;
      }

      if (text === '/help') {
        output.write('Commands:\n');
        output.write('  /help           Show commands\n');
        output.write('  /history        Show conversation history\n');
        output.write('  /edit <number>  Edit a user message and regenerate from there\n');
        output.write('  exit            Quit\n');
        output.write('Tip: press Ctrl+C while streaming to stop the current response.\n');
        continue;
      }

      if (text === '/history') {
        printHistory();
        continue;
      }

      if (text.startsWith('/edit')) {
        const [, rawTurn] = text.split(/\s+/, 2);
        const turn = Number(rawTurn);
        const userIndexes = getUserMessageIndexes(session.getState().conversation);
        if (!Number.isInteger(turn) || turn < 1 || turn > userIndexes.length) {
          output.write('Usage: /edit <user-message-number>. See /history for message numbers.\n');
          continue;
        }

        const userMessageIndex = userIndexes[turn - 1];
        const current = session.getState().conversation[userMessageIndex];
        const edited = (await rl.question(`Edit message (${current.content}): `)).trim();
        if (!edited) {
          output.write('Edit cancelled.\n');
          continue;
        }

        deltaPrintedForTurn = false;
        activeAssistantPrefixPrinted = false;
        await session.editUserMessage(userMessageIndex, edited);
        printFinalAssistantIfNeeded();
        continue;
      }

      try {
        deltaPrintedForTurn = false;
        activeAssistantPrefixPrinted = false;
        await session.submitPrompt(text);
        printFinalAssistantIfNeeded();
      } catch (error) {
        output.write(
          `Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`
        );
      }
    }
  } finally {
    rl.close();
  }

  return 0;
}

run()
  .then((code) => {
    process.exit(code);
  })
  .catch((error) => {
    output.write(`Fatal: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    process.exit(1);
  });
