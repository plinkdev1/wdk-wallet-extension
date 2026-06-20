/**
 * Inpage script entry point. Loaded into every web page (matching the
 * manifest content_scripts matches) BEFORE any dApp code runs. Implements:
 *
 *   1. EIP-1193 provider available as `window.ethereum` (legacy fallback,
 *      ONLY if window.ethereum is undefined - never overwrite existing wallets).
 *   2. EIP-6963 announce for modern multi-wallet discovery.
 *
 * UUID for EIP-6963: read from document.currentScript.dataset.uuid, which is
 * set by the content script (B4.2) BEFORE appending this script to the DOM.
 * Fallback to a placeholder if not present (e.g., in test environments where
 * the module is imported directly rather than loaded via <script>).
 *
 * Per PRD 01 Addendum S12.6.4.
 */

import { WdkInpageProvider } from './provider.js';
import { announceEip6963Provider } from './eip6963.js';

/** Read the per-install UUID injected by content script via script.dataset.uuid. */
function readInstallUuid(): string {
  if (typeof document !== 'undefined' && document.currentScript instanceof HTMLScriptElement) {
    const fromDataset = document.currentScript.dataset.uuid;
    if (typeof fromDataset === 'string' && fromDataset.length > 0) {
      return fromDataset;
    }
  }
  // Fallback for test environments or content-script-bypass loading.
  return 'wdk-wallet-placeholder-uuid-v1';
}

/** Read the icon URL injected by content script via script.dataset.icon.
 *  Returns undefined if not present; announceEip6963Provider falls back to its placeholder. */
function readInstallIcon(): string | undefined {
  if (typeof document !== 'undefined' && document.currentScript instanceof HTMLScriptElement) {
    const fromDataset = document.currentScript.dataset.icon;
    if (typeof fromDataset === 'string' && fromDataset.length > 0) {
      return fromDataset;
    }
  }
  return undefined;
}

declare global {
  interface Window {
    ethereum?: unknown;
  }
}

const provider = new WdkInpageProvider();

// EIP-6963 modern announce. Always do this regardless of window.ethereum state.
announceEip6963Provider(provider, readInstallUuid(), readInstallIcon());

// Legacy fallback. ONLY set window.ethereum if it's undefined. Never overwrite
// existing wallets (Metamask, Rabby, etc.) - that's the modern-wallet etiquette
// since EIP-6963 became standard.
if (typeof window !== 'undefined' && !window.ethereum) {
  Object.defineProperty(window, 'ethereum', {
    value: provider,
    writable: false,
    configurable: false,
  });
}

export { provider };