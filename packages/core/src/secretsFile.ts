/**
 * Encrypted secrets storage shared by the CLI and Desktop runtimes.
 *
 * Secrets are stored in `secrets.json` next to `settings.json` in the
 * platform userData directory.  Each value is individually encrypted with
 * AES-256-GCM using a key derived from the current machine identity
 * (hostname + username) via PBKDF2-SHA256.
 *
 * This means:
 *  - The file is unreadable on another machine / another OS user account.
 *  - Both CLI (plain Node) and Desktop (Electron) can read/write the same
 *    file without any Electron-specific APIs.
 *  - Zero extra npm dependencies (uses Node's built-in `crypto` module).
 *
 * Migration: if a plain-text `apiKey` is found in `settings.json` it will
 * be silently migrated to `secrets.json` the next time settings are saved.
 */

import {
  createCipheriv,
  createDecipheriv,
  pbkdf2Sync,
  randomBytes,
} from 'crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'fs';
import os from 'os';
import { dirname, join } from 'path';

// ─── key derivation ────────────────────────────────────────────────────────

const ALGORITHM = 'aes-256-gcm';
const KEY_LEN = 32;
const IV_LEN = 12;
/** Fixed application-specific salt string fed into PBKDF2. */
const KDF_SALT = 'curraint-secrets-v1';
const KDF_ITERATIONS = 100_000;

/**
 * Derives a 256-bit key from (hostname, username, fixed-app-salt).
 * The result is cached per process so PBKDF2 only runs once.
 */
let _cachedKey: Buffer | undefined;
function derivedKey(): Buffer {
  if (!_cachedKey) {
    const identity = `${os.hostname()}:${os.userInfo().username}`;
    _cachedKey = pbkdf2Sync(identity, KDF_SALT, KDF_ITERATIONS, KEY_LEN, 'sha256');
  }
  return _cachedKey;
}

// ─── crypto helpers ────────────────────────────────────────────────────────

type EncryptedEntry = { iv: string; tag: string; data: string };

function encryptValue(plaintext: string, key: Buffer): EncryptedEntry {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: encrypted.toString('base64'),
  };
}

function decryptEntry(entry: EncryptedEntry, key: Buffer): string {
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(entry.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(entry.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(entry.data, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

function isEncryptedEntry(value: unknown): value is EncryptedEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as EncryptedEntry).iv === 'string' &&
    typeof (value as EncryptedEntry).tag === 'string' &&
    typeof (value as EncryptedEntry).data === 'string'
  );
}

// ─── file I/O ──────────────────────────────────────────────────────────────

/**
 * Returns the platform-specific userData directory (mirrors `userDataDir` in
 * settingsFile.ts — duplicated here to avoid a circular import).
 */
function appUserDataDir(): string {
  const APP_NAME = 'curraint';
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

type SecretsStore = Record<string, EncryptedEntry>;

function readSecretsStore(): SecretsStore {
  const filePath = secretsFilePath();
  if (!existsSync(filePath)) return {};
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as SecretsStore;
  } catch {
    return {};
  }
}

function writeSecretsStore(store: SecretsStore): void {
  const filePath = secretsFilePath();
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf8');
  // On Unix, restrict to owner-read/write only (like SSH keys).
  if (process.platform !== 'win32') {
    chmodSync(filePath, 0o600);
  }
}

// ─── public API ────────────────────────────────────────────────────────────

/**
 * Reads a single secret by `id`. Returns an empty string when absent or when
 * decryption fails (e.g. the file was written on a different machine).
 */
export function loadSecret(id: string): string {
  const store = readSecretsStore();
  const entry = store[id];
  if (!isEncryptedEntry(entry)) return '';
  try {
    return decryptEntry(entry, derivedKey());
  } catch {
    return '';
  }
}

/**
 * Persists a single secret. Passing an empty string removes the entry so the
 * secrets file doesn't accumulate stale keys.
 */
export function saveSecret(id: string, value: string): void {
  const store = readSecretsStore();
  if (value === '') {
    delete store[id];
  } else {
    store[id] = encryptValue(value, derivedKey());
  }
  writeSecretsStore(store);
}

/**
 * Removes a secret by `id`. No-op if the key is absent.
 */
export function deleteSecret(id: string): void {
  const store = readSecretsStore();
  if (!(id in store)) return;
  delete store[id];
  writeSecretsStore(store);
}
