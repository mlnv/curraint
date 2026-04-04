import { pbkdf2Sync } from 'crypto';
import os from 'os';

const KEY_LEN = 32;
const KDF_SALT = 'curraint-secrets-v1';
const KDF_ITERATIONS = 600_000;

let _cachedKey: Buffer | undefined;

/**
 * Derives a 256-bit key from (hostname, username, fixed-app-salt).
 * Result is cached per process so PBKDF2 runs only once.
 */
export function derivedKey(): Buffer {
  if (!_cachedKey) {
    const identity = `${os.hostname()}:${os.userInfo().username}`;
    _cachedKey = pbkdf2Sync(identity, KDF_SALT, KDF_ITERATIONS, KEY_LEN, 'sha256');
  }
  return _cachedKey;
}
