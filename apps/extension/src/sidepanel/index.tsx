/**
 * Side panel React entry (Phase C). Mounts the SAME wallet App as the popup
 * into #root — the panel is the full wallet, just in a surface that persists
 * while the user browses (the popup closes on blur).
 *
 * Reusing popup/app keeps a single source of truth for the UI: every view,
 * the worker bridge, theme + brand providers, and the lock state machine are
 * identical across both surfaces. The throw on a missing #root surfaces HTML
 * bugs immediately rather than silently rendering nowhere.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../popup/app.js';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('[sidepanel] #root element not found in index.html');
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
