import type { ChatMessage } from '../common/types';

function getElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing element: ${selector}`);
  }

  return element;
}

const form = getElement<HTMLFormElement>('#chat-form');
const prompt = getElement<HTMLTextAreaElement>('#prompt');
const messagesNode = getElement<HTMLElement>('#messages');
const statusNode = getElement<HTMLElement>('#status');

const history: ChatMessage[] = [];

function setStatus(text: string): void {
  statusNode.textContent = text;
}

function appendMessage(role: 'user' | 'assistant', content: string): void {
  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.textContent = content;
  messagesNode.appendChild(div);
  messagesNode.scrollTop = messagesNode.scrollHeight;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const content = prompt.value.trim();
  if (!content) {
    return;
  }

  history.push({ role: 'user', content });
  appendMessage('user', content);
  prompt.value = '';
  setStatus('Sending...');

  try {
    const reply = await window.flowai.chat(history);
    history.push({ role: 'assistant', content: reply });
    appendMessage('assistant', reply);
    setStatus('');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Unknown error');
  }
});
