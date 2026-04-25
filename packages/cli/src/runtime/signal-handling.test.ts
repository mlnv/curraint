import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installSigintHandler } from './signal-handling';

describe('installSigintHandler', () => {
  const processLike = {
    on: vi.fn(),
    off: vi.fn(),
    exit: vi.fn(),
  };

  const output = {
    write: vi.fn(),
  };

  const rl = {
    close: vi.fn(),
  };

  const session = {
    getState: vi.fn(),
    stopResponse: vi.fn(),
  };

  const nextSession = {
    getState: vi.fn(),
    stopResponse: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('waits for onExit cleanup before exiting when idle', async () => {
    let resolveOnExit: (() => void) | undefined;
    const onExit = vi.fn(() => new Promise<void>((resolve) => {
      resolveOnExit = resolve;
    }));

    session.getState.mockReturnValue({ isSending: false });

    installSigintHandler({
      processLike,
      output,
      rl,
      session,
      onExit,
    });

    const handler = processLike.on.mock.calls[0][1] as () => void;
    handler();

    expect(onExit).toHaveBeenCalledTimes(1);
    expect(processLike.exit).not.toHaveBeenCalled();

    resolveOnExit?.();
    await Promise.resolve();

    expect(processLike.exit).toHaveBeenCalledWith(0);
  });

  it('stops the active response instead of exiting when a request is in flight', async () => {
    session.getState.mockReturnValue({ isSending: true });
    session.stopResponse.mockResolvedValue(undefined);

    const cleanup = installSigintHandler({
      processLike,
      output,
      rl,
      getSession: () => session,
    });

    const handler = processLike.on.mock.calls[0][1] as () => void;
    handler();

    expect(session.stopResponse).toHaveBeenCalledTimes(1);
    expect(output.write).not.toHaveBeenCalled();
    expect(rl.close).not.toHaveBeenCalled();
    expect(processLike.exit).not.toHaveBeenCalled();

    cleanup();
    expect(processLike.off).toHaveBeenCalledWith('SIGINT', handler);
  });

  it('logs stopResponse rejections instead of leaking an unhandled rejection', async () => {
    const error = new Error('stop failed');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    session.getState.mockReturnValue({ isSending: true });
    session.stopResponse.mockRejectedValue(error);

    installSigintHandler({
      processLike,
      output,
      rl,
      getSession: () => session,
    });

    const handler = processLike.on.mock.calls[0][1] as () => void;
    handler();
    await Promise.resolve();

    expect(consoleError).toHaveBeenCalledWith('Failed to stop active response after SIGINT.', error);
    consoleError.mockRestore();
  });

  it('uses the latest session from getSession', () => {
    nextSession.getState.mockReturnValue({ isSending: true });
    nextSession.stopResponse.mockResolvedValue(undefined);

    installSigintHandler({
      processLike,
      output,
      rl,
      getSession: () => nextSession,
    });

    const handler = processLike.on.mock.calls[0][1] as () => void;
    handler();

    expect(nextSession.stopResponse).toHaveBeenCalledTimes(1);
    expect(session.stopResponse).not.toHaveBeenCalled();
  });

  it('closes readline and exits when idle', () => {
    session.getState.mockReturnValue({ isSending: false });

    installSigintHandler({
      processLike,
      output,
      rl,
      getSession: () => session,
    });

    const handler = processLike.on.mock.calls[0][1] as () => void;
    handler();

    expect(output.write).toHaveBeenCalledWith('\n');
    expect(rl.close).toHaveBeenCalledTimes(1);
    expect(processLike.exit).toHaveBeenCalledWith(0);
  });
});