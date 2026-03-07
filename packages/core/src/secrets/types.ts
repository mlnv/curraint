export type EncryptedEntry = { iv: string; tag: string; data: string };

export function isEncryptedEntry(value: unknown): value is EncryptedEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as EncryptedEntry).iv === 'string' &&
    typeof (value as EncryptedEntry).tag === 'string' &&
    typeof (value as EncryptedEntry).data === 'string'
  );
}
