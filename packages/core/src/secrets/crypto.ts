import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import type { EncryptedEntry } from './types';

const ALGORITHM = 'aes-256-gcm';
const IV_LEN = 12;

export function encryptValue(plaintext: string, key: Buffer): EncryptedEntry {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: encrypted.toString('base64')
  };
}

export function decryptEntry(entry: EncryptedEntry, key: Buffer): string {
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(entry.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(entry.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(entry.data, 'base64')),
    decipher.final()
  ]).toString('utf8');
}
