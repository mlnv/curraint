export async function warmupCopilotSession(
  _model: string,
  _systemPrompt: string
): Promise<void> {
  // Copilot is handled via pi-ai which is stateless; no warmup needed.
}

export async function resetCopilotSession(
  _model: string,
  _systemPrompt: string
): Promise<void> {
  // Copilot is handled via pi-ai which is stateless; no session to reset.
}

export async function copilotTestConnection(_model: string): Promise<string> {
  return 'Copilot connection testing is handled via pi-ai.';
}

export async function stopCopilotClient(): Promise<void> {
  // Copilot is handled via pi-ai which is stateless; no client to stop.
}
