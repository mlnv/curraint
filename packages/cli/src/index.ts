import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { version } from '../package.json';
import { renderMarkdown } from './markdown';
import { createChatSessionCore } from '@curraint/core';
import { composeConversation, normalizeSettings } from '@curraint/core';
import { loadSettingsFromFile, loadRawSettingsFromFile, saveSettingsToFile, settingsFilePath } from '@curraint/core';
import { isProviderId, requiresApiKeyForProvider, PROVIDER_OPTIONS, getProviderConfig, ENABLE_COPILOT_PROVIDER } from '@curraint/core';
import type { ChatMessage, EndpointSettings } from '@curraint/core';
import {
  chatCompletion,
  chatCompletionStream,
  copilotChatStream,
  resetCopilotSession,
  stopCopilotClient
} from '@curraint/core';
import type { ChatSessionCore, ChatSessionTransport } from '@curraint/core';

const c = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  cyan:    '\x1b[36m',
} as const;

const divider = () =>
  `${c.dim}${'─'.repeat(Math.max(20, (process.stdout.columns ?? 60) - 2))}${c.reset}`;

/**
 * Prompts for a secret value (e.g. API key) without echoing characters to the
 * terminal. Temporarily overrides readline's internal `_writeToOutput` to mute
 * key-echo, writes the prompt directly to stdout, then restores normal echo
 * after the user presses Enter.
 */
async function askSecret(rl: readline.Interface, prompt: string): Promise<string> {
  const stdin = process.stdin as NodeJS.ReadStream;

  if (!stdin.isTTY) {
    // Non-TTY (piped input): no echo risk, use readline normally.
    output.write(prompt);
    const answer = await (rl as unknown as { question(q: string): Promise<string> }).question('');
    return answer.trim();
  }

  // ConPTY / real TTY: _writeToOutput tricks don't suppress echo because the
  // terminal echoes characters at the PTY level before Node.js sees them.
  // setRawMode(true) disables that echo at the OS level.
  //
  // We temporarily remove all stdin 'data' listeners (including readline's
  // internal one) so only our raw-mode reader processes keystrokes, then
  // restore them afterwards.
  // Important: write the prompt AFTER removing listeners and enabling raw mode
  // so that readline's internal line-refresh logic can't overwrite the prompt text.
  const savedListeners = stdin.rawListeners('data').slice() as ((...args: unknown[]) => void)[];
  savedListeners.forEach(fn => stdin.removeListener('data', fn));

  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');

  output.write(prompt);

  const value = await new Promise<string>((resolve) => {
    let buf = '';
    const onData = (char: string) => {
      switch (char) {
        case '\r':
        case '\n':
          stdin.removeListener('data', onData);
          resolve(buf);
          break;
        case '\u0003': // Ctrl+C
          stdin.removeListener('data', onData);
          output.write('\n');
          stdin.setRawMode(false);
          savedListeners.forEach(fn => stdin.on('data', fn));
          process.exit(0);
          break;
        case '\u007f': // Delete/Backspace
        case '\b':
          if (buf.length > 0) {
            buf = buf.slice(0, -1);
            output.write('\b \b'); // erase last asterisk
          }
          break;
        default:
          if (char >= ' ') {
            // When pasting, char may contain multiple characters at once.
            buf += char;
            output.write('*'.repeat(char.length));
          }
      }
    };
    stdin.on('data', onData);
  });

  stdin.setRawMode(false);
  output.write('\n');
  savedListeners.forEach(fn => stdin.on('data', fn));

  return value.trim();
}

const SLASH_COMMANDS: Array<{ command: string; description: string }> = [
  { command: '/help',     description: 'Show commands' },
  { command: '/history',  description: 'Show conversation history' },
  { command: '/edit',     description: 'Edit a user message and regenerate' },
  { command: '/provider', description: 'Switch the AI provider' },
  { command: '/model',    description: 'Change the model' },
  { command: '/version',  description: 'Show version' },
  { command: '/clear',    description: 'Clear the screen' },
  { command: '/exit',     description: 'Quit' },
];

/**
 * Reads a line of input. When running in a real TTY, shows a slash-command
 * completion menu as the user types "/" and supports navigating with arrow
 * keys and accepting with Tab or Enter. Falls back to plain readline in
 * non-TTY (piped) environments.
 */
async function readLineWithCompletion(rl: readline.Interface, prompt: string): Promise<string> {
  const stdin = process.stdin as NodeJS.ReadStream;
  if (!stdin.isTTY) {
    return rl.question(prompt);
  }

  return new Promise<string>((resolve) => {
    let buf = '';
    let suggestions: typeof SLASH_COMMANDS = [];
    let selectedIdx = 0;

    const savedListeners = stdin.rawListeners('data').slice() as ((...args: unknown[]) => void)[];
    savedListeners.forEach(fn => stdin.removeListener('data', fn));

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    output.write(prompt);

    const redraw = () => {
      let out = '\r\x1b[J' + prompt + buf;

      if (suggestions.length > 0) {
        out += '\n';
        suggestions.forEach((s, i) => {
          if (i === selectedIdx) {
            out += `\x1b[7m  ${s.command.padEnd(12)} ${s.description}\x1b[0m`;
          } else {
            out += `  ${c.cyan}${s.command.padEnd(12)}${c.reset}${c.dim} ${s.description}${c.reset}`;
          }
          if (i < suggestions.length - 1) out += '\n';
        });
        out += `\x1b[${suggestions.length}A\r${prompt}${buf}`;
      }

      output.write(out);
    };

    const updateSuggestions = () => {
      if (buf.startsWith('/') && !buf.includes(' ')) {
        suggestions = SLASH_COMMANDS.filter(c => c.command.startsWith(buf));
        if (selectedIdx >= suggestions.length) selectedIdx = 0;
      } else {
        suggestions = [];
        selectedIdx = 0;
      }
      redraw();
    };

    const cleanup = () => {
      output.write('\r\x1b[J');
      output.write(prompt + buf + '\n');
      stdin.setRawMode(false);
      savedListeners.forEach(fn => stdin.on('data', fn));
    };

    const onData = (char: string) => {
      if (char === '\x1b[A') { // Up arrow
        if (suggestions.length > 0) {
          selectedIdx = (selectedIdx - 1 + suggestions.length) % suggestions.length;
          redraw();
        }
        return;
      }
      if (char === '\x1b[B') { // Down arrow
        if (suggestions.length > 0) {
          selectedIdx = (selectedIdx + 1) % suggestions.length;
          redraw();
        }
        return;
      }

      switch (char) {
        case '\r':
        case '\n':
          if (suggestions.length > 0) {
            buf = suggestions[selectedIdx]!.command;
            suggestions = [];
            selectedIdx = 0;
          }
          stdin.removeListener('data', onData);
          cleanup();
          resolve(buf);
          break;

        case '\t':
          if (suggestions.length > 0) {
            buf = suggestions[selectedIdx]!.command;
            suggestions = [];
            selectedIdx = 0;
            redraw();
          }
          break;

        case '\x1b': // Escape — dismiss menu
          suggestions = [];
          selectedIdx = 0;
          redraw();
          break;

        case '\u0003': // Ctrl+C
          stdin.removeListener('data', onData);
          output.write('\r\x1b[J\n');
          stdin.setRawMode(false);
          savedListeners.forEach(fn => stdin.on('data', fn));
          process.exit(0);
          break;

        case '\u007f': // Backspace
        case '\b':
          if (buf.length > 0) {
            buf = buf.slice(0, -1);
            updateSuggestions();
          }
          break;

        default:
          if (char.length === 1 && char >= ' ') {
            buf += char;
            updateSuggestions();
          }
          break;
      }
    };

    stdin.on('data', onData);
  });
}

function buildTransport(settings: EndpointSettings): ChatSessionTransport {
  if (ENABLE_COPILOT_PROVIDER && settings.provider === 'copilot') {
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

      if (chosen.id === 'custom') {
        const customUrl = (await rl.question(`Base URL [${providerDefaults.defaultBaseUrl}]: `)).trim();
        if (customUrl) {
          settings = normalizeSettings({ ...settings, baseUrl: customUrl });
        }
        const key = await askSecret(rl, 'API key (leave blank if not required): ');
        if (key) {
          settings = normalizeSettings({ ...settings, apiKey: key });
        }
      }
    }
  }

  // Prompt for API key if the chosen provider requires one.
  if (requiresApiKeyForProvider(settings.provider) && !settings.apiKey) {
    output.write(`No API key configured for provider "${settings.provider}".\n`);
    const key = await askSecret(rl, 'Enter API key: ');
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

  // Braille spinner shown while the AI is streaming.
  let spinnerTimer: ReturnType<typeof setInterval> | null = null;
  const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

  const startSpinner = () => {
    let idx = 0;
    output.write('\n');
    spinnerTimer = setInterval(() => {
      output.write(`\r${c.yellow}AI:${c.reset} ${c.dim}${spinnerFrames[idx++ % spinnerFrames.length]}${c.reset}`);
    }, 80);
  };

  const stopSpinner = () => {
    if (spinnerTimer !== null) {
      clearInterval(spinnerTimer);
      spinnerTimer = null;
      output.write('\r\x1b[K'); // erase spinner line
    }
  };

  let session: ChatSessionCore = createChatSessionCore(buildTransport(settings));

  const subscribeToSession = (s: ChatSessionCore): void => {
    s.subscribe({
      onDelta: (_delta) => {
        deltaPrintedForTurn = true;
        if (!activeAssistantPrefixPrinted) {
          activeAssistantPrefixPrinted = true;
          startSpinner();
        }
      }
    });
  };

  subscribeToSession(session);

  output.write(`${c.bold}curraint CLI${c.reset} — provider: ${c.cyan}${settings.provider}${c.reset}, model: ${c.cyan}${settings.model}${c.reset}. Settings: ${c.dim}${settingsFilePath()}${c.reset}. Type ${c.cyan}/exit${c.reset} to quit. Use ${c.cyan}/help${c.reset} for commands.\n`);

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
    stopSpinner();
    activeAssistantPrefixPrinted = false;

    const current = session.getState();
    const last = current.conversation[current.conversation.length - 1];
    const content = last?.role === 'assistant' ? last.content.trim() : '';

    if (content) {
      output.write(`\n${c.yellow}AI:${c.reset}\n`);
      output.write(renderMarkdown(content));
      output.write('\n');
    }

    if (current.status) {
      output.write(`${c.dim}Status: ${current.status}${c.reset}\n`);
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
      if (index > 0) output.write('\n');
      if (message.role === 'assistant') {
        output.write(`${c.dim}${index + 1}.${c.reset} ${c.yellow}AI:${c.reset}\n`);
        output.write(renderMarkdown(message.content));
        output.write('\n');
      } else {
        output.write(`${c.dim}${index + 1}.${c.reset} ${c.green}You:${c.reset} ${message.content}\n`);
      }
    });
  };

  try {
    while (true) {
      output.write(`\n${divider()}\n`);
      const text = (await readLineWithCompletion(rl, `${c.green}You:${c.reset} `)).trim();
      if (!text) {
        continue;
      }

      if (text === '/exit') {
        break;
      }

      if (text === '/help') {
        output.write(`${c.bold}Commands:${c.reset}\n`);
        output.write(`  ${c.cyan}/help${c.reset}           ${c.dim}Show commands${c.reset}\n`);
        output.write(`  ${c.cyan}/history${c.reset}        ${c.dim}Show conversation history${c.reset}\n`);
        output.write(`  ${c.cyan}/edit${c.reset} <number>  ${c.dim}Edit a user message and regenerate from there${c.reset}\n`);
        output.write(`  ${c.cyan}/provider${c.reset}       ${c.dim}Switch the AI provider${c.reset}\n`);
        output.write(`  ${c.cyan}/model${c.reset}          ${c.dim}Change the model for the current provider${c.reset}\n`);
        output.write(`  ${c.cyan}/version${c.reset}        ${c.dim}Show version${c.reset}\n`);
        output.write(`  ${c.cyan}/clear${c.reset}          ${c.dim}Clear the screen${c.reset}\n`);
        output.write(`  ${c.cyan}/exit${c.reset}           ${c.dim}Quit${c.reset}\n`);
        output.write(`${c.dim}Tip: press Ctrl+C while streaming to stop the current response.${c.reset}\n`);
        continue;
      }

      if (text === '/history') {
        printHistory();
        continue;
      }

      if (text === '/version') {
        output.write(`${version}\n`);
        continue;
      }

      if (text === '/clear') {
        output.write('\x1b[2J\x1b[H');
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
        if (ENABLE_COPILOT_PROVIDER && settings.provider === 'copilot') {
          await stopCopilotClient();
        }

        const providerDefaults = getProviderConfig(chosen.id);
        settings = normalizeSettings({
          ...settings,
          provider: chosen.id,
          model: providerDefaults.defaultModel,
          baseUrl: providerDefaults.defaultBaseUrl,
          apiKey: ''  // Always clear API key on provider switch; re-enter below if needed.
        });

        // Always prompt for API key when switching to a provider that requires one.
        if (providerDefaults.requiresApiKey) {
          const key = await askSecret(rl, `Enter API key for ${chosen.label}: `);
          if (!key) {
            output.write('API key is required for this provider. Provider unchanged.\n');
            settings = loadSettings();
            continue;
          }
          settings = normalizeSettings({ ...settings, apiKey: key });
        }

        // For custom providers, also prompt for base URL and optional API key.
        if (chosen.id === 'custom') {
          const customUrl = (await rl.question(`Base URL [${providerDefaults.defaultBaseUrl}]: `)).trim();
          if (customUrl) {
            settings = normalizeSettings({ ...settings, baseUrl: customUrl });
          }
          const key = await askSecret(rl, 'API key (leave blank if not required): ');
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

      if (text === '/model') {
        output.write(`Current model: ${settings.model} (provider: ${settings.provider})\n`);
        const newModel = (await rl.question('Enter new model name: ')).trim();
        if (!newModel) {
          output.write('No model entered. Model unchanged.\n');
          continue;
        }
        if (newModel === settings.model) {
          output.write(`Already using model "${settings.model}".\n`);
          continue;
        }
        settings = normalizeSettings({ ...settings, model: newModel });
        if (ENABLE_COPILOT_PROVIDER && settings.provider === 'copilot') {
          await resetCopilotSession(settings.model, settings.systemPrompt);
        }
        session = createChatSessionCore(buildTransport(settings));
        subscribeToSession(session);
        const saveModel = (await rl.question('Save model change to settings file? [Y/n] ')).trim().toLowerCase();
        if (saveModel !== 'n') {
          saveSettingsToFile(settings);
          output.write(`Settings saved to ${settingsFilePath()}.\n`);
        }
        output.write(`Model changed to "${settings.model}". Conversation cleared.\n`);
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
          `${c.red}Error:${c.reset} ${error instanceof Error ? error.message : 'Unknown error'}\n`
        );
      }
    }
  } finally {
    rl.close();
    if (ENABLE_COPILOT_PROVIDER && settings.provider === 'copilot') {
      await stopCopilotClient();
    }
  }

  return 0;
}

if (process.argv.includes('--version') || process.argv.includes('-V')) {
  output.write(`${version}\n`);
  process.exit(0);
}

run()
  .then((code) => {
    process.exit(code);
  })
  .catch((error) => {
    output.write(`Fatal: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    process.exit(1);
  });
