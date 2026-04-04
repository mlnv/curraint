import { test as base, _electron as electronLauncher } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const electronExecutable = require('electron') as string;
const desktopMain = join(__dirname, '../../desktop/dist/main/main.js');

const DEFAULT_WINDOW_FIND_RETRIES = 15;
const DEFAULT_WINDOW_FIND_INTERVAL_MS = 200;

export type ElectronFixtures = {
  app: ElectronApplication;
  chatPage: Page;
  settingsPage: Page;
};

/**
 * Polls app.windows() until a window whose URL contains `fragment` is found.
 * All desktop windows are created at startup (show: false), so they should
 * appear within a short time after firstWindow() resolves.
 */
async function findWindowByUrl(
  app: ElectronApplication,
  fragment: string,
  retries = DEFAULT_WINDOW_FIND_RETRIES,
  intervalMs = DEFAULT_WINDOW_FIND_INTERVAL_MS,
): Promise<Page> {
  for (let i = 0; i < retries; i++) {
    const match = app.windows().find((p) => p.url().includes(fragment));
    if (match) return match;
    await new Promise<void>((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Window with URL fragment "${fragment}" not found after ${retries} retries`);
}

/**
 * Shows and focuses a BrowserWindow in the main process whose URL contains `urlFragment`.
 * The lookup is performed in the Electron main process via app.evaluate.
 */
async function showWindow(app: ElectronApplication, urlFragment: string): Promise<void> {
  await app.evaluate(
    ({ BrowserWindow }, fragment) => {
      const win = BrowserWindow.getAllWindows().find(
        (w) => !w.isDestroyed() && w.webContents.getURL().includes(fragment),
      );
      win?.show();
      win?.focus();
    },
    urlFragment,
  );
}

async function closeElectronApp(app: ElectronApplication): Promise<void> {
  try {
    const closed = app.waitForEvent('close', { timeout: 5_000 });
    await app.evaluate(({ app: electronApp }) => {
      electronApp.quit();
    });
    await closed;
  } catch {
    await app.close();
  }
}

export const test = base.extend<ElectronFixtures>({
  app: async ({}, use) => {
    // Redirect APPDATA to a fresh temp dir so the app never touches the
    // real settings/secrets files on disk and each test run is fully isolated.
    const tempAppData = mkdtempSync(join(tmpdir(), 'curraint-e2e-'));
    try {
      const app = await electronLauncher.launch({
        executablePath: electronExecutable,
        args: [desktopMain, ...(process.env.CI ? ['--no-sandbox', '--disable-dev-shm-usage'] : [])],
        env: {
          ...process.env,
          NODE_ENV: 'test',
          // Override all platform user-data paths used by core's paths.ts / secrets/storage.ts
          APPDATA: tempAppData,           // Windows
          HOME: tempAppData,              // macOS / Linux
          XDG_CONFIG_HOME: tempAppData,   // Linux XDG
        },
      });
      // Wait until the first window is ready before any fixture can proceed
      await app.firstWindow();
      await use(app);
      await closeElectronApp(app);
    } finally {
      rmSync(tempAppData, { recursive: true, force: true });
    }
  },

  chatPage: async ({ app }, use) => {
    const page = await findWindowByUrl(app, 'index.html');
    await page.waitForLoadState('domcontentloaded');
    await showWindow(app, 'index.html');
    await use(page);
  },

  settingsPage: async ({ app }, use) => {
    const page = await findWindowByUrl(app, 'settings.html');
    await page.waitForLoadState('domcontentloaded');
    await showWindow(app, 'settings.html');
    await use(page);
  },
});

export { expect } from '@playwright/test';
