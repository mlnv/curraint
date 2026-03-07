import { decryptEntry, encryptValue } from './crypto';
import { derivedKey } from './key-derivation';
import { readSecretsStore, writeSecretsStore } from './storage';
import { isEncryptedEntry } from './types';

/** Reads a secret by id. Returns '' when absent or decryption fails. */
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

/** Persists a secret. Passing '' removes the entry. */
export function saveSecret(id: string, value: string): void {
  const store = readSecretsStore();
  if (value === '') {
    delete store[id];
  } else {
    store[id] = encryptValue(value, derivedKey());
  }
  writeSecretsStore(store);
}

/** Removes a secret by id. No-op if absent. */
export function deleteSecret(id: string): void {
  const store = readSecretsStore();
  if (!(id in store)) return;
  delete store[id];
  writeSecretsStore(store);
}
