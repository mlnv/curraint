import { buildPiTransport } from '@curraint/core';
import type { EndpointSettings, ChatSessionTransport } from '@curraint/core';

export function buildTransport(settings: EndpointSettings): ChatSessionTransport {
  return buildPiTransport(settings);
}
