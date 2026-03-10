import type readline from 'node:readline/promises';
import type { EndpointSettings } from '@curraint/core';
import type { ChatSessionCore } from '@curraint/core';
import type { SessionUI } from '../session-ui';

export type CommandContext = {
  rl: readline.Interface;
  getSettings: () => EndpointSettings;
  setSettings: (s: EndpointSettings) => void;
  getSession: () => ChatSessionCore;
  rebuildSession: (newSettings: EndpointSettings) => void;
  sessionUI: SessionUI;
};

export type CommandResult = 'continue' | 'break';
