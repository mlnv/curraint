import { describe, it, expect } from 'vitest';
import {
  DesktopSecretsStrategy,
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
});
