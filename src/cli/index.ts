import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { composeConversation, normalizeSettings } from '../common/settings';
import type { ChatMessage, EndpointSettings } from '../common/types';
import { chatCompletion } from '../common/openaiCompatibleClient';

function envSettings(): EndpointSettings {
  return normalizeSettings({
    apiKey: process.env.FLOWAI_API_KEY,
    baseUrl: process.env.FLOWAI_BASE_URL,
    model: process.env.FLOWAI_MODEL,
    systemPrompt: process.env.FLOWAI_SYSTEM_PROMPT
  });
}

async function run(): Promise<number> {
  const settings = envSettings();

  if (!settings.apiKey) {
    output.write('Missing FLOWAI_API_KEY.\n');
    return 1;
  }

  const rl = readline.createInterface({ input, output });
  const history: ChatMessage[] = [];

  output.write('FlowAI CLI chat. Type "exit" to quit.\n');

  try {
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
        const composed = composeConversation(settings, history);
        const result = await chatCompletion(settings, composed);
        output.write(`AI: ${result.message}\n`);
        history.push({ role: 'assistant', content: result.message });
      } catch (error) {
        output.write(
          `Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`
        );
      }
    }
  } finally {
    rl.close();
  }

  return 0;
}

run()
  .then((code) => {
    process.exit(code);
  })
  .catch((error) => {
    output.write(`Fatal: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    process.exit(1);
  });
