import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import {
  createChatSessionCore,
  settingsFilePath,
  ENABLE_COPILOT_PROVIDER,
  stopCopilotClient,
  generateSessionId,
  deriveTitle,
  saveSession,
} from '@curraint/core';
import type { ChatSessionCore, EndpointSettings } from '@curraint/core';
import { c, divider } from './theme';
import { loadSettings } from './settings';
import { isFirstRun, runFirstRunSetup, askForApiKeyIfNeeded } from './setup';
import { buildTransport } from './transport';
import { readLineWithCompletion } from './readline-completion';
import { SessionUI } from './session-ui';
import { dispatchSlashCommand } from './commands/registry';
import type { CommandContext } from './commands/types';

export async function run(): Promise<number> {
  let settings = loadSettings();
  const rl = readline.createInterface({ input, output });

  const firstRun = isFirstRun();
  if (firstRun) {
    settings = await runFirstRunSetup(rl, settings);
  }

  const finalSettings = await askForApiKeyIfNeeded(rl, settings, firstRun);
  if (!finalSettings) {
    rl.close();
    return 1;
  }
  settings = finalSettings;

  const sessionUI = new SessionUI();
  let session: ChatSessionCore = createChatSessionCore(buildTransport(settings));
  sessionUI.subscribe(session);

  let currentSessionId: string | null = null;
  let currentSessionCreatedAt = 0;

  const rebuildSession = (newSettings: EndpointSettings): void => {
    settings = newSettings;
    session = createChatSessionCore(buildTransport(newSettings));
    sessionUI.subscribe(session);
    currentSessionId = null;
  };

  const ctx: CommandContext = {
    rl,
    getSettings: () => settings,
    setSettings: (s) => { settings = s; },
    getSession: () => session,
    rebuildSession,
    sessionUI,
    getCurrentSessionId: () => currentSessionId,
    setCurrentSessionId: (id, createdAt = Date.now()) => {
      currentSessionId = id;
      currentSessionCreatedAt = id ? createdAt : 0;
    },
    getSettingsFilePath: () => settingsFilePath(),
  };

  output.write(
    `${c.bold}curraint CLI${c.reset} — provider: ${c.cyan}${settings.provider}${c.reset}, model: ${c.cyan}${settings.model}${c.reset}. Settings: ${c.dim}${settingsFilePath()}${c.reset}. Type ${c.cyan}/exit${c.reset} to quit. Use ${c.cyan}/help${c.reset} for commands.\n`,
  );

  process.on('SIGINT', () => {
    if (session.getState().isSending) {
      void session.stopResponse();
      return;
    }
    output.write('\n');
    rl.close();
    process.exit(0);
  });

  try {
    while (true) {
      output.write(`\n${divider()}\n`);
      const text = (await readLineWithCompletion(rl, `${c.green}You:${c.reset} `)).trim();
      if (!text) continue;

      const slashResult = await dispatchSlashCommand(text, ctx);
      if (slashResult === 'break') break;
      if (slashResult === 'continue') continue;

      try {
        sessionUI.resetTurnState();
        await session.submitPrompt(text);
        sessionUI.printFinalAssistantIfNeeded(session);

        // Auto-save session after each completed response
        if (settings.enableSessionSaving) {
          const state = session.getState();
          const msgs = state.conversation.filter((m) => m.role !== 'system');
          if (msgs.length > 0) {
            if (!currentSessionId) {
              currentSessionId = generateSessionId();
              currentSessionCreatedAt = Date.now();
            }
            const firstUser = msgs.find((m) => m.role === 'user')?.content ?? '';
            saveSession({
              id: currentSessionId,
              title: deriveTitle(firstUser),
              createdAt: currentSessionCreatedAt,
              updatedAt: Date.now(),
              messages: msgs
            });
          }
        }
      } catch (error) {
        output.write(
          `${c.red}Error:${c.reset} ${error instanceof Error ? error.message : 'Unknown error'}\n`,
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
