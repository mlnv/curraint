// Platform-agnostic strategy interface for API key encryption.
export interface SecretsStrategy {
  encrypt(plaintext: string): Promise<string>;
  decrypt(stored: string): Promise<string>;
}

// --- Shared constants -------------------------------------------------------

const IV_LEN = 12;
const KEY_LEN = 32;

// --- Desktop strategy (Node.js crypto, machine-bound) -----------------------
// Uses AES-256-GCM with a PBKDF2 key derived from the machine's hostname and
// username. The encrypted blob cannot be decrypted on a different machine.
//
// Node.js built-ins are required inline (not at the top of the module) so
// that esbuild does not emit top-level require('crypto') / require('os') calls
// in the bundle. Those top-level calls would throw on mobile where Node.js
// built-ins are unavailable, even if the desktop strategy is never used.

type DesktopBlob = { iv: string; tag: string; data: string };

const KDF_SALT = 'curraint-obsidian-v1';
const KDF_ITERATIONS = 100_000;

export class DesktopSecretsStrategy implements SecretsStrategy {
  private readonly _key: Buffer;

  constructor() {
    // Inline require so esbuild does not hoist Node.js built-in imports to the
    // top of the bundle, which would throw on mobile where Node.js is absent.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { pbkdf2Sync } = require('crypto') as typeof import('crypto');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const os = require('os') as typeof import('os');
    const identity = `${os.hostname()}:${os.userInfo().username}`;
    this._key = pbkdf2Sync(identity, KDF_SALT, KDF_ITERATIONS, KEY_LEN, 'sha256');
  }

  async encrypt(plaintext: string): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createCipheriv, randomBytes } = require('crypto') as typeof import('crypto');
    const key = this._key;
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const blob: DesktopBlob = {
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      data: encrypted.toString('base64'),
    };
    return JSON.stringify(blob);
  }

  async decrypt(stored: string): Promise<string> {
    try {
      const blob = JSON.parse(stored) as DesktopBlob;
      if (!blob.iv || !blob.tag || !blob.data) return '';
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createDecipheriv } = require('crypto') as typeof import('crypto');
      const key = this._key;
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(blob.iv, 'base64'));
      decipher.setAuthTag(Buffer.from(blob.tag, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(blob.data, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      return '';
    }
  }
}

// --- Mobile strategy (Web Crypto API) ---------------------------------------
// Uses AES-256-GCM via the standard Web Crypto API, which is available in
// Obsidian's mobile runtime (iOS / Android). The key is a random 32-byte
// device key generated on first run and persisted in plugin data.
// Web Crypto AES-GCM output already appends the 16-byte authentication tag.

type MobileBlob = { iv: string; data: string };

export class MobileSecretsStrategy implements SecretsStrategy {
  private readonly keyPromise: Promise<CryptoKey>;

  constructor(deviceKey: string) {
    this.keyPromise = this.importKey(deviceKey);
  }

  private async importKey(deviceKey: string): Promise<CryptoKey> {
    const keyBytes = Uint8Array.from(atob(deviceKey), (c) => c.charCodeAt(0));
    return globalThis.crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async encrypt(plaintext: string): Promise<string> {
    const key = await this.keyPromise;
    const iv = new Uint8Array(IV_LEN);
    globalThis.crypto.getRandomValues(iv);
    const ciphertext = await globalThis.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(plaintext)
    );
    const blob: MobileBlob = {
      iv: btoa(String.fromCharCode(...Array.from(iv))),
      data: btoa(String.fromCharCode(...Array.from(new Uint8Array(ciphertext)))),
    };
    return JSON.stringify(blob);
  }

  async decrypt(stored: string): Promise<string> {
    try {
      const blob = JSON.parse(stored) as MobileBlob;
      if (!blob.iv || !blob.data) return '';
      const key = await this.keyPromise;
      const iv = Uint8Array.from(atob(blob.iv), (c) => c.charCodeAt(0));
      const ciphertext = Uint8Array.from(atob(blob.data), (c) => c.charCodeAt(0));
      const plaintext = await globalThis.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext
      );
      return new TextDecoder().decode(plaintext);
    } catch {
      return '';
    }
  }
}

// --- Factory + device key helper --------------------------------------------

// Generates a cryptographically random 32-byte key as a base64 string.
// Uses globalThis.crypto.getRandomValues which is available on both desktop
// (Node.js 15+) and mobile (Web Crypto API standard).
export function generateMobileDeviceKey(): string {
  const bytes = new Uint8Array(KEY_LEN);
  globalThis.crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...Array.from(bytes)));
}

export function createSecretsStrategy(isMobile: boolean, deviceKey?: string): SecretsStrategy {
  if (isMobile) {
    if (!deviceKey) throw new Error('Mobile device key is required but was not provided');
    return new MobileSecretsStrategy(deviceKey);
  }
  return new DesktopSecretsStrategy();
}
