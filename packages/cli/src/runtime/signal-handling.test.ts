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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stops the active response instead of exiting when a request is in flight', async () => {
    session.getState.mockReturnValue({ isSending: true });

    const cleanup = installSigintHandler({
      processLike,
      output,
      rl,
      session,
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

  it('closes readline and exits when idle', () => {
    session.getState.mockReturnValue({ isSending: false });

    installSigintHandler({
      processLike,
      output,
      rl,
      session,
    });

    const handler = processLike.on.mock.calls[0][1] as () => void;
    handler();

    expect(output.write).toHaveBeenCalledWith('\n');
    expect(rl.close).toHaveBeenCalledTimes(1);
    expect(processLike.exit).toHaveBeenCalledWith(0);
  });
});