import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { DEFAULT_SETTINGS } from '../common/defaults';
import type { ChatMessage, EndpointSettings } from '../common/types';
import { chatCompletion } from '../common/openaiCompatibleClient';

function envSettings(): EndpointSettings {
  return {
    apiKey: process.env.FLOWAI_API_KEY ?? DEFAULT_SETTINGS.apiKey,
    baseUrl: process.env.FLOWAI_BASE_URL ?? DEFAULT_SETTINGS.baseUrl,
    model: process.env.FLOWAI_MODEL ?? DEFAULT_SETTINGS.model,
    systemPrompt: process.env.FLOWAI_SYSTEM_PROMPT ?? DEFAULT_SETTINGS.systemPrompt
  };
}

async function run(): Promise<void> {
  const settings = envSettings();

  if (!settings.apiKey) {
    output.write('Missing FLOWAI_API_KEY.\n');
    process.exit(1);
  }

  const rl = readline.createInterface({ input, output });
  const history: ChatMessage[] = [];

  output.write('FlowAI CLI chat. Type "exit" to quit.\n');

  while (true) {
    const text = (await rl.question('You: ')).trim();
    if (!text) {
      continue;
    }

    if (text.toLowerCase() === 'exit') {
      break;
    }

    history.push({ role: 'user', content: text });

    try {
      const composed: ChatMessage[] = settings.systemPrompt
        ? [{ role: 'system', content: settings.systemPrompt }, ...history]
        : history;

      const result = await chatCompletion(settings, composed);
      output.write(`AI: ${result.message}\n`);
      history.push({ role: 'assistant', content: result.message });
    } catch (error) {
      output.write(
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`
      );
    }
  }

  rl.close();
}

run().catch((error) => {
  output.write(`Fatal: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
  process.exit(1);
});
