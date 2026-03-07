import { join } from 'path';

const APP_NAME = 'curraint';

/**
 * Returns the platform-specific user data directory for the app.
 * Matches Electron's app.getPath('userData') so the CLI and Desktop share
 * the same settings file.
 */
export function userDataDir(): string {
  switch (process.platform) {
    case 'win32':
      return join(
        process.env['APPDATA'] ?? join(process.env['USERPROFILE'] ?? '', 'AppData', 'Roaming'),
        APP_NAME
      );
    case 'darwin':
      return join(process.env['HOME'] ?? '', 'Library', 'Application Support', APP_NAME);
    default:
      return join(
        process.env['XDG_CONFIG_HOME'] ?? join(process.env['HOME'] ?? '', '.config'),
        APP_NAME
      );
  }
}

export function settingsFilePath(): string {
  return join(userDataDir(), 'settings.json');
}
