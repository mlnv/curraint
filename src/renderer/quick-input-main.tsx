import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QuickInputApp } from './quick-input-app';
import './styles.css';

const rootElement = document.getElementById('app');
if (!rootElement) {
  throw new Error('Missing root element');
}

createRoot(rootElement).render(
  <StrictMode>
    <QuickInputApp />
  </StrictMode>
);
