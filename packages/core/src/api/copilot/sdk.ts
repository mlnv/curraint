import type { Sdk } from './types';

// The SDK is ESM-only, so we must load it via dynamic import() at runtime.
// Wrapping in Function() prevents tsup/esbuild from rewriting it to require().
async function loadSdk(): Promise<Sdk> {
  return Function('return import("@github/copilot-sdk")')() as Promise<Sdk>;
}

let sdkCache: Sdk | null = null;

export async function getSdk(): Promise<Sdk> {
  if (!sdkCache) sdkCache = await loadSdk();
  return sdkCache;
}
