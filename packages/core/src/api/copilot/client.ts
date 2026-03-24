import type { CopilotClient as CopilotClientType } from '@github/copilot-sdk';
import { getSdk } from './sdk';

// Strip env vars that interfere with the @github/copilot child process.
const ENV_KEYS_TO_STRIP = [
  'NODE_OPTIONS',
  'VSCODE_INSPECTOR_OPTIONS',
  'ELECTRON_RUN_AS_NODE',
  'CHROME_CRASHPAD_PIPE_NAME',
  'ELECTRON_NO_ATTACH_CONSOLE',
  'ELECTRON_ENABLE_STACK_DUMPING'
];

function stripConflictingEnvVars(): void {
  for (const key of ENV_KEYS_TO_STRIP) delete process.env[key];
}

// Singleton CopilotClient — spawns the CLI subprocess once and reuses it.
let clientInstance: CopilotClientType | null = null;

export async function getClient(): Promise<CopilotClientType> {
  if (!clientInstance) {
    const { CopilotClient } = await getSdk();
    stripConflictingEnvVars();
    // Use TCP instead of stdio so Electron's pipe interception doesn't break the channel.
    clientInstance = new CopilotClient({ useLoggedInUser: true, useStdio: false });
  }
  return clientInstance;
}

export async function stopClient(): Promise<void> {
  if (clientInstance) {
    await clientInstance.stop().catch(() => {});
    clientInstance = null;
  }
}
