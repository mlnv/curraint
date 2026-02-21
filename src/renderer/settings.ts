import type { EndpointSettings } from '../common/types';

function getElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing element: ${selector}`);
  }

  return element;
}

const form = getElement<HTMLFormElement>('#settings-form');
const apiKeyInput = getElement<HTMLInputElement>('#apiKey');
const baseUrlInput = getElement<HTMLInputElement>('#baseUrl');
const modelInput = getElement<HTMLInputElement>('#model');
const systemPromptInput = getElement<HTMLTextAreaElement>('#systemPrompt');
const statusNode = getElement<HTMLElement>('#status');

function setStatus(text: string): void {
  statusNode.textContent = text;
}

function readForm(): EndpointSettings {
  return {
    apiKey: apiKeyInput.value.trim(),
    baseUrl: baseUrlInput.value.trim(),
    model: modelInput.value.trim(),
    systemPrompt: systemPromptInput.value.trim()
  };
}

function fillForm(settings: EndpointSettings): void {
  apiKeyInput.value = settings.apiKey;
  baseUrlInput.value = settings.baseUrl;
  modelInput.value = settings.model;
  systemPromptInput.value = settings.systemPrompt;
}

window.flowai
  .getSettings()
  .then((settings) => fillForm(settings))
  .catch((error: unknown) => {
    setStatus(error instanceof Error ? error.message : 'Failed to load settings');
  });

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = readForm();
  setStatus('Saving...');

  try {
    await window.flowai.saveSettings(payload);
    setStatus('Saved');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Failed to save settings');
  }
});
