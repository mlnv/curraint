import { describe, it, expect, vi } from 'vitest';
import {
  DesktopSecretsStrategy,
  InvalidMobileDeviceKeyError,
  MobileSecretsStrategy,
  generateMobileDeviceKey,
} from './secrets';

describe('DesktopSecretsStrategy', () => {
  it('round-trips a non-empty key', async () => {
    const strategy = new DesktopSecretsStrategy();
    const encrypted = await strategy.encrypt('sk-test-api-key-12345');
    expect(encrypted).not.toBe('sk-test-api-key-12345');
    expect(await strategy.decrypt(encrypted)).toBe('sk-test-api-key-12345');
  });

  it('produces different ciphertexts for the same plaintext (random IV)', async () => {
    const strategy = new DesktopSecretsStrategy();
    const key = 'my-key';
    expect(await strategy.encrypt(key)).not.toBe(await strategy.encrypt(key));
  });

  it('returns empty string for invalid ciphertext', async () => {
    const strategy = new DesktopSecretsStrategy();
    expect(await strategy.decrypt('not-valid-json')).toBe('');
    expect(await strategy.decrypt('{}')).toBe('');
  });

  it('round-trips an empty string', async () => {
    const strategy = new DesktopSecretsStrategy();
    expect(await strategy.decrypt(await strategy.encrypt(''))).toBe('');
  });
});

describe('MobileSecretsStrategy', () => {
  it('round-trips a non-empty key', async () => {
    const strategy = new MobileSecretsStrategy(generateMobileDeviceKey());
    const encrypted = await strategy.encrypt('sk-test-api-key-12345');
    expect(encrypted).not.toBe('sk-test-api-key-12345');
    expect(await strategy.decrypt(encrypted)).toBe('sk-test-api-key-12345');
  });

  it('produces different ciphertexts for the same plaintext (random IV)', async () => {
    const strategy = new MobileSecretsStrategy(generateMobileDeviceKey());
    const key = 'my-key';
    expect(await strategy.encrypt(key)).not.toBe(await strategy.encrypt(key));
  });

  it('returns empty string for invalid ciphertext', async () => {
    const strategy = new MobileSecretsStrategy(generateMobileDeviceKey());
    expect(await strategy.decrypt('not-valid-json')).toBe('');
    expect(await strategy.decrypt('{}')).toBe('');
  });

  it('round-trips an empty string', async () => {
    const strategy = new MobileSecretsStrategy(generateMobileDeviceKey());
    expect(await strategy.decrypt(await strategy.encrypt(''))).toBe('');
  });

  it('cannot decrypt ciphertext from a different device key', async () => {
    const strategy1 = new MobileSecretsStrategy(generateMobileDeviceKey());
    const strategy2 = new MobileSecretsStrategy(generateMobileDeviceKey());
    const encrypted = await strategy1.encrypt('secret-value');
    expect(await strategy2.decrypt(encrypted)).toBe('');
  });

  it('rejects malformed base64 device keys with a typed error', async () => {
    expect(() => new MobileSecretsStrategy('not base64!!!')).toThrowError(
      InvalidMobileDeviceKeyError
    );
    expect(() => new MobileSecretsStrategy('not base64!!!')).toThrow(
      'Mobile device key must be a valid base64-encoded 32-byte AES key'
    );
  });

  it('rejects device keys that decode to the wrong length', async () => {
    const wrongLengthKey = btoa(String.fromCharCode(...Array.from(new Uint8Array(33))));
    expect(() => new MobileSecretsStrategy(wrongLengthKey)).toThrowError(
      InvalidMobileDeviceKeyError
    );
    expect(() => new MobileSecretsStrategy(wrongLengthKey)).toThrow(
      'Mobile device key must decode to exactly 32 bytes'
    );
  });

  it('defers CryptoKey import until first use', async () => {
    const importKeySpy = vi.spyOn(globalThis.crypto.subtle, 'importKey');

    try {
      const strategy = new MobileSecretsStrategy(generateMobileDeviceKey());

      expect(importKeySpy).not.toHaveBeenCalled();

      await strategy.encrypt('secret-value');

      expect(importKeySpy).toHaveBeenCalledTimes(1);
    } finally {
      importKeySpy.mockRestore();
    }
  });

  it('rejects import failures with a typed error', async () => {
    const originalSubtle = globalThis.crypto.subtle;
    const importFailure = new DOMException('import failed', 'OperationError');

    Object.defineProperty(globalThis.crypto, 'subtle', {
      configurable: true,
      value: {
        ...originalSubtle,
        importKey: async () => {
          throw importFailure;
        },
      } satisfies SubtleCrypto,
    });

    try {
      const strategy = new MobileSecretsStrategy(generateMobileDeviceKey());
      await expect(strategy.encrypt('secret-value')).rejects.toBeInstanceOf(
        InvalidMobileDeviceKeyError
      );
      await expect(strategy.encrypt('secret-value')).rejects.toThrow(
        'Failed to import mobile device key for AES-GCM encryption'
      );
    } finally {
      Object.defineProperty(globalThis.crypto, 'subtle', {
        configurable: true,
        value: originalSubtle,
      });
    }
  });
});
