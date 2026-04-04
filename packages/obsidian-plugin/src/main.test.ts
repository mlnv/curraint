import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Platform } from 'obsidian';
import type { WorkspaceLeaf } from 'obsidian';
import CurraintPlugin, { DEFAULT_PLUGIN_SETTINGS } from './main';
import { ChatView, CHAT_VIEW_TYPE } from './chat/chat-view';
import { PROVIDER_CONFIGS } from '@curraint/core';
import { createSecretsStrategy, generateMobileDeviceKey } from './secrets';

vi.mock('./secrets', async () => {
  const actual = await vi.importActual<typeof import('./secrets')>('./secrets');
  return {
    ...actual,
    createSecretsStrategy: vi.fn(() => ({
      encrypt: vi.fn(),
      decrypt: vi.fn(),
    })),
    generateMobileDeviceKey: vi.fn(() => 'generated-mobile-key'),
  };
});

describe('CurraintPlugin - mobile onload', () => {
  beforeEach(() => {
    Platform.isMobile = true;
    Platform.isDesktop = false;
    vi.clearAllMocks();
  });

  afterEach(() => {
    Platform.isMobile = false;
    Platform.isDesktop = true;
  });

  it('saves settings once after applying all mobile migrations', async () => {
    const plugin = new CurraintPlugin();
    vi.spyOn(plugin, 'loadSettings').mockImplementation(async () => {
      plugin.settings = {
        ...DEFAULT_PLUGIN_SETTINGS,
        provider: 'lmstudio',
        baseUrl: 'http://127.0.0.1:1234/v1',
        mobileDeviceKey: '',
      };
    });
    const saveSettings = vi.spyOn(plugin, 'saveSettings').mockResolvedValue();
    plugin.registerView = vi.fn();
    plugin.addRibbonIcon = vi.fn();
    plugin.addCommand = vi.fn();
    plugin.addSettingTab = vi.fn();

    await plugin.onload();

    expect(generateMobileDeviceKey).toHaveBeenCalledTimes(1);
    expect(saveSettings).toHaveBeenCalledTimes(1);
    expect(plugin.settings.mobileDeviceKey).toBe('generated-mobile-key');
    expect(plugin.settings.provider).toBe('openai');
    expect(plugin.settings.baseUrl).toBe(PROVIDER_CONFIGS.openai.defaultBaseUrl);
    expect(createSecretsStrategy).toHaveBeenCalledWith(true, 'generated-mobile-key');
  });
});

describe('CurraintPlugin - unload', () => {
  it('destroys chat registries before detaching chat leaves', () => {
    const calls: string[] = [];
    const destroyFirst = vi.fn(() => { calls.push('destroy:first'); });
    const destroySecond = vi.fn(() => { calls.push('destroy:second'); });
    const detachLeavesOfType = vi.fn(() => { calls.push('detach'); });

    const firstView = Object.assign(Object.create(ChatView.prototype), {
      destroyRegistry: destroyFirst,
    });
    const secondView = Object.assign(Object.create(ChatView.prototype), {
      destroyRegistry: destroySecond,
    });

    const leaves = [
      { view: firstView },
      { view: secondView },
    ] as WorkspaceLeaf[];

    const plugin = new CurraintPlugin();
    (plugin as CurraintPlugin & {
      app: {
        workspace: {
          getLeavesOfType: (viewType: string) => WorkspaceLeaf[];
          detachLeavesOfType: (viewType: string) => void;
        };
      };
    }).app = {
      workspace: {
        getLeavesOfType: (viewType: string) => {
          expect(viewType).toBe(CHAT_VIEW_TYPE);
          return leaves;
        },
        detachLeavesOfType,
      },
    };

    plugin.onunload();

    expect(destroyFirst).toHaveBeenCalledTimes(1);
    expect(destroySecond).toHaveBeenCalledTimes(1);
    expect(detachLeavesOfType).toHaveBeenCalledWith(CHAT_VIEW_TYPE);
    expect(calls).toEqual(['destroy:first', 'destroy:second', 'detach']);
  });
});