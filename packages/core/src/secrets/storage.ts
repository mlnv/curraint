import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import type { EncryptedEntry } from './types';

export type SecretsStore = Record<string, EncryptedEntry>;

const APP_NAME = 'curraint';

function appUserDataDir(): string {
  switch (process.platform) {
    case 'win32':
      return join(
        process.env['APPDATA'] ?? join(process.env['USERPROFILE'] ?? '', 'AppData', 'Roaming'),
        APP_NAME
      );
    case 'darwin':
      return join(process.env['HOME'] ?? '', 'Library', 'Application Support', APP_NAME);
    default:
      return join(
        process.env['XDG_CONFIG_HOME'] ?? join(process.env['HOME'] ?? '', '.config'),
        APP_NAME
      );
  }
}

export function secretsFilePath(): string {
  return join(appUserDataDir(), 'secrets.json');
}

export function readSecretsStore(): SecretsStore {
  const filePath = secretsFilePath();
  if (!existsSync(filePath)) return {};
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as SecretsStore;
  } catch {
    return {};
  }
}

export function writeSecretsStore(store: SecretsStore): void {
  const filePath = secretsFilePath();
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf8');
  if (process.platform !== 'win32') chmodSync(filePath, 0o600);
}
