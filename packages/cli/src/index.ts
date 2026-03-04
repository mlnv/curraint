import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { createChatSessionCore } from '@curraint/core';
import { composeConversation, normalizeSettings } from '@curraint/core';
import { loadSettingsFromFile, loadRawSettingsFromFile, saveSettingsToFile, settingsFilePath } from '@curraint/core';
import { isProviderId, requiresApiKeyForProvider, PROVIDER_OPTIONS, getProviderConfig } from '@curraint/core';
import type { ChatMessage, EndpointSettings } from '@curraint/core';
import {
  chatCompletion,
  chatCompletionStream,
  copilotChatStream,
  resetCopilotSession,
  stopCopilotClient
} from '@curraint/core';
import type { ChatSessionCore, ChatSessionTransport } from '@curraint/core';

function buildTransport(settings: EndpointSettings): ChatSessionTransport {
  if (settings.provider === 'copilot') {
    return {
      streamChat: async (messages, onDelta, options) => {
        const composed = composeConversation(settings, messages);
        let streamedMessage = '';
        try {
          return await copilotChatStream(
            settings.model,
            composed,
            {
              onDelta: (delta) => {
                streamedMessage += delta;
                onDelta(delta);
              }
            },
            { signal: options?.signal }
          );
        } catch (error) {
          const isAbortError =
            (error instanceof DOMException && error.name === 'AbortError') ||
            (error instanceof Error && error.name === 'AbortError');
          if (isAbortError) {
            return streamedMessage;
          }
          throw error;
        }
      },
      clearSession: () => resetCopilotSession(settings.model, settings.systemPrompt)
    };
  }

  return {
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
          { signal: options?.signal }
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
  };
}

/**
 * Loads settings from the shared Desktop app settings file, then overlays
 * any CURRAINT_* environment variables on top so env vars always win.
 */
function loadSettings(): EndpointSettings {
  const file = loadSettingsFromFile();
  const providerCandidate = process.env['CURRAINT_PROVIDER'];

  return normalizeSettings({
    ...file,
    ...(providerCandidate && isProviderId(providerCandidate) ? { provider: providerCandidate } : {}),
    ...(process.env['CURRAINT_API_KEY'] !== undefined ? { apiKey: process.env['CURRAINT_API_KEY'] } : {}),
    ...(process.env['CURRAINT_BASE_URL'] !== undefined ? { baseUrl: process.env['CURRAINT_BASE_URL'] } : {}),
    ...(process.env['CURRAINT_MODEL'] !== undefined ? { model: process.env['CURRAINT_MODEL'] } : {}),
    ...(process.env['CURRAINT_SYSTEM_PROMPT'] !== undefined ? { systemPrompt: process.env['CURRAINT_SYSTEM_PROMPT'] } : {})
  });
}

async function run(): Promise<number> {
  let settings = loadSettings();
  const rl = readline.createInterface({ input, output });

  // First-run: no settings file yet → ask which provider to use.
  const isFirstRun = Object.keys(loadRawSettingsFromFile()).length === 0;
  if (isFirstRun) {
    output.write('Welcome to curraint! No settings found. Choose a provider to get started.\n');
    output.write('Available providers:\n');
    PROVIDER_OPTIONS.forEach((p, i) => {
      output.write(`  ${i + 1}. ${p.label}\n`);
    });
    const choice = (await rl.question(`Pick a provider [1-${PROVIDER_OPTIONS.length}]: `)).trim();
    const idx = Number(choice) - 1;
    if (Number.isInteger(idx) && idx >= 0 && idx < PROVIDER_OPTIONS.length) {
      const chosen = PROVIDER_OPTIONS[idx]!;
      const providerDefaults = getProviderConfig(chosen.id);
      settings = normalizeSettings({
        ...settings,
        provider: chosen.id,
        model: providerDefaults.defaultModel,
        baseUrl: providerDefaults.defaultBaseUrl
      });
      output.write(`Provider set to: ${chosen.label}\n`);
    }
  }

  // Prompt for API key if the chosen provider requires one.
  if (requiresApiKeyForProvider(settings.provider) && !settings.apiKey) {
    output.write(`No API key configured for provider "${settings.provider}".\n`);
    const key = (await rl.question('Enter API key: ')).trim();
    if (!key) {
      output.write('API key is required. Exiting.\n');
      rl.close();
      return 1;
    }
    settings = normalizeSettings({ ...settings, apiKey: key });
    const save = (await rl.question('Save to settings file for future use? [Y/n] ')).trim().toLowerCase();
    if (save !== 'n') {
      saveSettingsToFile(settings);
      output.write(`Settings saved to ${settingsFilePath()}.\n`);
    }
  } else if (isFirstRun) {
    saveSettingsToFile(settings);
    output.write(`Settings saved to ${settingsFilePath()}.\n`);
  }

  let deltaPrintedForTurn = false;
  let activeAssistantPrefixPrinted = false;

  let session: ChatSessionCore = createChatSessionCore(buildTransport(settings));

  const subscribeToSession = (s: ChatSessionCore): void => {
    s.subscribe({
      onDelta: (delta) => {
        deltaPrintedForTurn = true;
        if (!activeAssistantPrefixPrinted) {
          output.write('AI: ');
          activeAssistantPrefixPrinted = true;
        }
        output.write(delta);
      }
    });
  };

  subscribeToSession(session);

  output.write(`curraint CLI — provider: ${settings.provider}, model: ${settings.model}. Settings: ${settingsFilePath()}. Type "exit" to quit. Use /help for commands.\n`);

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
        output.write('  /provider       Switch the AI provider\n');
        output.write('  exit            Quit\n');
        output.write('Tip: press Ctrl+C while streaming to stop the current response.\n');
        continue;
      }

      if (text === '/history') {
        printHistory();
        continue;
      }

      if (text === '/provider') {
        output.write('Available providers:\n');
        PROVIDER_OPTIONS.forEach((p, i) => {
          const current = p.id === settings.provider ? ' (current)' : '';
          output.write(`  ${i + 1}. ${p.label}${current}\n`);
        });
        const choice = (await rl.question(`Pick a provider [1-${PROVIDER_OPTIONS.length}]: `)).trim();
        const idx = Number(choice) - 1;
        if (!Number.isInteger(idx) || idx < 0 || idx >= PROVIDER_OPTIONS.length) {
          output.write('Invalid choice. Provider unchanged.\n');
          continue;
        }
        const chosen = PROVIDER_OPTIONS[idx]!;
        if (chosen.id === settings.provider) {
          output.write(`Already using ${chosen.label}.\n`);
          continue;
        }

        // Stop the old copilot subprocess if switching away.
        if (settings.provider === 'copilot') {
          await stopCopilotClient();
        }

        const providerDefaults = getProviderConfig(chosen.id);
        settings = normalizeSettings({
          ...settings,
          provider: chosen.id,
          model: providerDefaults.defaultModel,
          baseUrl: providerDefaults.defaultBaseUrl,
          // Clear stale API key when switching to a provider that doesn't need one.
          apiKey: providerDefaults.requiresApiKey ? settings.apiKey : ''
        });

        // Prompt for API key if the new provider needs one.
        if (providerDefaults.requiresApiKey && !settings.apiKey) {
          const key = (await rl.question(`Enter API key for ${chosen.label}: `)).trim();
          if (key) {
            settings = normalizeSettings({ ...settings, apiKey: key });
          }
        }

        const save = (await rl.question('Save provider change to settings file? [Y/n] ')).trim().toLowerCase();
        if (save !== 'n') {
          saveSettingsToFile(settings);
          output.write(`Settings saved to ${settingsFilePath()}.\n`);
        }

        // Rebuild the session with the new transport; conversation is cleared.
        session = createChatSessionCore(buildTransport(settings));
        subscribeToSession(session);
        output.write(`Switched to ${chosen.label} (${settings.model}). Conversation cleared.\n`);
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
    if (settings.provider === 'copilot') {
      await stopCopilotClient();
    }
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
