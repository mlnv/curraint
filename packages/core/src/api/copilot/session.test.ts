import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getClientMock, getSdkMock } = vi.hoisted(() => ({
  getClientMock: vi.fn(),
  getSdkMock: vi.fn()
}));

vi.mock('./client', () => ({
  getClient: getClientMock
}));

vi.mock('./sdk', () => ({
  getSdk: getSdkMock
}));

describe('copilot session lifecycle', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('drops the cached session when the client singleton is replaced', async () => {
    const firstSession = {
      disconnect: vi.fn().mockResolvedValue(undefined)
    };
    const secondSession = {
      disconnect: vi.fn().mockResolvedValue(undefined)
    };

    const firstClient = {
      createSession: vi.fn().mockResolvedValue(firstSession)
    };
    const secondClient = {
      createSession: vi.fn().mockResolvedValue(secondSession)
    };

    getClientMock.mockResolvedValueOnce(firstClient).mockResolvedValueOnce(secondClient);
    getSdkMock.mockResolvedValue({ approveAll: vi.fn() });

    const sessionModule = await import('./session');

    const originalSession = await sessionModule.getOrCreateSession('gpt-4o', 'system', false);
    const restartedSession = await sessionModule.getOrCreateSession('gpt-4o', 'system', false);

    expect(originalSession).toBe(firstSession);
    expect(restartedSession).toBe(secondSession);
    expect(firstSession.disconnect).toHaveBeenCalledOnce();
    expect(firstClient.createSession).toHaveBeenCalledOnce();
    expect(secondClient.createSession).toHaveBeenCalledOnce();
  });
});