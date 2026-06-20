/**
 * Popup React entry. Mounts App into #root.
 *
 * StrictMode is enabled in dev to catch effect double-invocation bugs early.
 * In production builds the StrictMode wrapper is preserved but its behavior
 * is a no-op (React only double-invokes in dev).
 *
 * The throw on missing #root surfaces popup HTML bugs immediately rather
 * than silently rendering nowhere.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app.js';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('[popup] #root element not found in index.html');
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);