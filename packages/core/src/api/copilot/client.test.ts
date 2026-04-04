import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSdkMock } = vi.hoisted(() => ({
  getSdkMock: vi.fn()
}));

vi.mock('./sdk', () => ({
  getSdk: getSdkMock
}));

describe('copilot client lifecycle', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('restarts the singleton when the cached client is disconnected', async () => {
    const staleClient = {
      getState: vi.fn().mockReturnValue('disconnected'),
      ping: vi.fn(),
      stop: vi.fn().mockResolvedValue([])
    };

    const healthyClient = {
      getState: vi.fn().mockReturnValue('connected'),
      ping: vi.fn().mockResolvedValue({ message: 'ok', timestamp: Date.now() }),
      stop: vi.fn().mockResolvedValue([])
    };

    const CopilotClient = vi
      .fn()
      .mockReturnValueOnce(staleClient)
      .mockReturnValueOnce(healthyClient);

    getSdkMock.mockResolvedValue({ CopilotClient });

    const clientModule = await import('./client');

    expect(await clientModule.getClient()).toBe(staleClient);
    expect(await clientModule.getClient()).toBe(healthyClient);

    expect(staleClient.stop).toHaveBeenCalledOnce();
    expect(healthyClient.ping).not.toHaveBeenCalled();
    expect(CopilotClient).toHaveBeenNthCalledWith(1, {
      useLoggedInUser: true,
      useStdio: false
    });
    expect(CopilotClient).toHaveBeenNthCalledWith(2, {
      useLoggedInUser: true,
      useStdio: false
    });
  });

  it('restarts the singleton when the cached client fails a health ping', async () => {
    const staleClient = {
      getState: vi.fn().mockReturnValue('connected'),
      ping: vi.fn().mockRejectedValue(new Error('socket closed')),
      stop: vi.fn().mockResolvedValue([])
    };

    const healthyClient = {
      getState: vi.fn().mockReturnValue('connected'),
      ping: vi.fn().mockResolvedValue({ message: 'ok', timestamp: Date.now() }),
      stop: vi.fn().mockResolvedValue([])
    };

    const CopilotClient = vi
      .fn()
      .mockReturnValueOnce(staleClient)
      .mockReturnValueOnce(healthyClient);

    getSdkMock.mockResolvedValue({ CopilotClient });

    const clientModule = await import('./client');

    expect(await clientModule.getClient()).toBe(staleClient);
    expect(await clientModule.getClient()).toBe(healthyClient);

    expect(staleClient.ping).toHaveBeenCalledOnce();
    expect(staleClient.stop).toHaveBeenCalledOnce();
  });
});