import { describe, it, expect } from 'vitest';
import { encryptApiKey, decryptApiKey } from './secrets';

describe('encryptApiKey / decryptApiKey', () => {
  it('round-trips a non-empty key', () => {
    const plaintext = 'sk-test-api-key-12345';
    const encrypted = encryptApiKey(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decryptApiKey(encrypted)).toBe(plaintext);
  });

  it('produces different ciphertexts for the same plaintext (random IV)', () => {
    const key = 'my-key';
    expect(encryptApiKey(key)).not.toBe(encryptApiKey(key));
  });

  it('returns empty string for invalid ciphertext', () => {
    expect(decryptApiKey('not-valid-json')).toBe('');
    expect(decryptApiKey('{}')).toBe('');
  });

  it('round-trips an empty string', () => {
    expect(decryptApiKey(encryptApiKey(''))).toBe('');
  });
});
