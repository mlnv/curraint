import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SettingsApp } from './settings-app';
import './styles.css';

const rootElement = document.getElementById('app');
if (!rootElement) {
  throw new Error('Missing root element');
}

createRoot(rootElement).render(
  <StrictMode>
    <SettingsApp />
  </StrictMode>
);
