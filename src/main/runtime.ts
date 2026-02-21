import { app } from 'electron';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export function configureAppRuntime(): void {
  const sessionDataPath = join(app.getPath('temp'), 'curraint-session-data');

  if (!existsSync(sessionDataPath)) {
    mkdirSync(sessionDataPath, { recursive: true });
  }

  app.setPath('sessionData', sessionDataPath);
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
  app.commandLine.appendSwitch('disable-http-cache');
}
