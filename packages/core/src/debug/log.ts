import type log from 'electron-log';

let _debugEnabled: boolean =
  typeof process !== 'undefined' && process.env['CURRAINT_DEBUG'] === '1';

export function setDebugEnabled(flag: boolean): void {
  _debugEnabled = flag;
}

let _log: typeof log | null = null;

function getLog(): typeof log | null {
  if (_log) return _log;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const electronLog = require('electron-log/main') as { default: typeof log };
    _log = electronLog.default ?? (electronLog as unknown as typeof log);
    _log.transports.console.level = 'debug';
    _log.transports.file.level = 'debug';
    return _log;
  } catch {
    return null;
  }
}

function serializeData(data: unknown): string | undefined {
  if (data === undefined) return undefined;
  return JSON.stringify(data, null, 2).replace(
    /[^\x00-\x7F]/g,
    (c) => '\\u' + c.codePointAt(0)!.toString(16).padStart(4, '0')
  );
}

export function debugLog(category: string, message: string, data?: unknown): void {
  if (!_debugEnabled) return;
  const serialized = serializeData(data);
  const text = serialized
    ? `[${category}] ${message}\n${serialized}`
    : `[${category}] ${message}`;

  const logger = getLog();
  if (logger) {
    logger.debug(text);
  } else {
    console.log(`[DEBUG ${new Date().toISOString()}] ${text}`);
  }
}
