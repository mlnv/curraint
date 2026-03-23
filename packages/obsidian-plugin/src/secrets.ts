import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'crypto';
import os from 'os';

// AES-256-GCM encryption with a PBKDF2 key derived from machine identity.
// The encrypted blob is stored in plugin data.json. It is machine-bound:
// it cannot be decrypted on a different machine.
// This mirrors the approach used in @curraint/core secrets for consistency.
const ALGORITHM = 'aes-256-gcm';
const IV_LEN = 12;
const KEY_LEN = 32;
const KDF_SALT = 'curraint-obsidian-v1';
const KDF_ITERATIONS = 100_000;

type EncryptedBlob = { iv: string; tag: string; data: string };

let _cachedKey: Buffer | undefined;

function derivedKey(): Buffer {
  if (_cachedKey) return _cachedKey;
  const identity = `${os.hostname()}:${os.userInfo().username}`;
  _cachedKey = pbkdf2Sync(identity, KDF_SALT, KDF_ITERATIONS, KEY_LEN, 'sha256');
  return _cachedKey;
}

export function encryptApiKey(plaintext: string): string {
  const key = derivedKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const blob: EncryptedBlob = {
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: encrypted.toString('base64'),
  };
  return JSON.stringify(blob);
}

export function decryptApiKey(stored: string): string {
  try {
    const blob = JSON.parse(stored) as EncryptedBlob;
    if (!blob.iv || !blob.tag || !blob.data) return '';
    const key = derivedKey();
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(blob.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(blob.tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(blob.data, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return '';
  }
}
