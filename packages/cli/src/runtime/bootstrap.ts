import type readline from 'node:readline/promises';
import type { EndpointSettings } from '@curraint/core';
import { loadSettings } from '../settings';
import { askForApiKeyIfNeeded, isFirstRun, runFirstRunSetup } from '../setup';

export type BootstrapResult = {
  settings: EndpointSettings | null;
  exitCode: number;
};

export async function bootstrapCliSettings(
  rl: readline.Interface,
): Promise<BootstrapResult> {
  let settings = loadSettings();
  const firstRun = isFirstRun();

  if (firstRun) {
    settings = await runFirstRunSetup(rl, settings);
  }

  const finalSettings = await askForApiKeyIfNeeded(rl, settings, firstRun);
  if (!finalSettings) {
    return {
      settings: null,
      exitCode: 1,
    };
  }

  return {
    settings: finalSettings,
    exitCode: 0,
  };
}