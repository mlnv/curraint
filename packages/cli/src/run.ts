import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import {
  createChatSessionCore,
  settingsFilePath,
  ENABLE_COPILOT_PROVIDER,
  stopCopilotClient,
} from '@curraint/core';
import type { ChatSessionCore, EndpointSettings } from '@curraint/core';
import { c, divider } from './theme';
import { buildTransport } from './transport';
import { readLineWithCompletion } from './readline-completion';
import { SessionUI } from './session-ui';
import { dispatchSlashCommand } from './commands/registry';
import type { CommandContext } from './commands/types';
import { InputHistory } from './input-history';
import { bootstrapCliSettings } from './runtime/bootstrap';
import { installSigintHandler } from './runtime/signal-handling';
import { persistSessionIfEnabled } from './runtime/session-persistence';

/** Starts the interactive CLI chat loop. Returns an exit code (0 on clean exit, 1 on setup failure). */
export async function run(): Promise<number> {
  const rl = readline.createInterface({ input, output });

  const bootstrap = await bootstrapCliSettings(rl);
  if (!bootstrap.settings) {
    rl.close();
    return bootstrap.exitCode;
  }
  let settings = bootstrap.settings;

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

  let isShuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    rl.close();
    if (ENABLE_COPILOT_PROVIDER && settings.provider === 'copilot') {
      try {
        await stopCopilotClient();
      } catch {
        // ignore shutdown errors
      }
    }
  };

  const cleanupSigintHandler = installSigintHandler({
    output,
    rl,
    getSession: () => session,
    onExit: shutdown,
  });

  try {
    const history = new InputHistory();
    while (true) {
      output.write(`\n${divider()}\n`);
      const text = (await readLineWithCompletion(rl, `${c.green}You:${c.reset} `, history)).trim();
      if (!text) continue;

      history.push(text);

      const slashResult = await dispatchSlashCommand(text, ctx);
      if (slashResult === 'break') break;
      if (slashResult === 'continue') continue;

      try {
        sessionUI.resetTurnState();
        await session.submitPrompt(text);
        sessionUI.printFinalAssistantIfNeeded(session);
        sessionUI.printContextUsage(session, settings);

        const persistenceState = persistSessionIfEnabled({
          enableSessionSaving: settings.enableSessionSaving,
          conversation: session.getState().conversation,
          compactedContext: session.getState().compactedContext,
          currentSessionId,
          currentSessionCreatedAt,
        });
        currentSessionId = persistenceState.currentSessionId;
        currentSessionCreatedAt = persistenceState.currentSessionCreatedAt;
      } catch (error) {
        output.write(
          `${c.red}Error:${c.reset} ${error instanceof Error ? error.message : 'Unknown error'}\n`,
        );
      }
    }
  } finally {
    cleanupSigintHandler();
    await shutdown();
  }

  return 0;
}
