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

const COPILOT_CLIENT_OPTIONS = {
  useLoggedInUser: true,
  useStdio: false
} as const;

function isClientConnected(client: CopilotClientType): boolean {
  return client.getState() === 'connected';
}

async function isClientHealthy(client: CopilotClientType): Promise<boolean> {
  if (!isClientConnected(client)) return false;

  try {
    await client.ping('health check');
    return true;
  } catch {
    return false;
  }
}

async function createClient(): Promise<CopilotClientType> {
  const { CopilotClient } = await getSdk();
  stripConflictingEnvVars();
  return new CopilotClient(COPILOT_CLIENT_OPTIONS);
}

async function replaceClientInstance(): Promise<CopilotClientType> {
  const staleClient = clientInstance;
  clientInstance = null;

  if (staleClient) {
    await staleClient.stop().catch(() => {});
  }

  const freshClient = await createClient();
  clientInstance = freshClient;
  return freshClient;
}

// Singleton CopilotClient — spawns the CLI subprocess once and reuses it.
let clientInstance: CopilotClientType | null = null;

export async function getClient(): Promise<CopilotClientType> {
  if (!clientInstance) {
    // Use TCP instead of stdio so Electron's pipe interception doesn't break the channel.
    clientInstance = await createClient();
    return clientInstance;
  }

  if (!(await isClientHealthy(clientInstance))) {
    return replaceClientInstance();
  }

  return clientInstance;
}

export async function stopClient(): Promise<void> {
  if (clientInstance) {
    await clientInstance.stop().catch(() => {});
    clientInstance = null;
  }
}
