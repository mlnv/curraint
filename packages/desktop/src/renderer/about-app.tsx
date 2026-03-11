import { useEffect } from 'react';
import { applyTheme } from './lib/theme';

export function AboutApp(): React.JSX.Element {
  useEffect(() => {
    void window.curraint.getSettings().then(s => applyTheme(s.theme));
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 gap-3 text-center">
      <h1 className="text-3xl font-bold tracking-tight">curraint</h1>
      <p className="text-sm opacity-60">v{__APP_VERSION__}</p>
      <p className="text-sm opacity-80 max-w-xs">
        Tray-first AI chat client for OpenAI-compatible APIs.
      </p>
      <button
        className="text-xs opacity-40 hover:opacity-70 mt-4 font-mono underline cursor-pointer bg-transparent border-0 p-0"
        onClick={() => void window.curraint.openExternal('https://github.com/mlnv/curraint')}
      >
        github.com/mlnv/curraint
      </button>
      <button
        className="text-xs opacity-40 hover:opacity-70 mt-1 cursor-pointer bg-transparent border-0 p-0"
        onClick={() => void window.curraint.openLicensesWindow()}
      >
        Third-party licenses
      </button>
    </div>
  );
}
