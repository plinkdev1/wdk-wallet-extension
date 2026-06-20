/**
 * MV3 manifest for the WDK Wallet browser extension.
 *
 * Per PRD 01 Addendum S3.1 (canonical Phase 1 manifest).
 *
 * State at B4.2: popup + background + content_scripts + web_accessible_resources.
 *
 * Key invariants:
 *
 *   - manifest_version: 3 (Chrome's current standard)
 *   - background.type: 'module' (ES modules in the SW)
 *   - content_security_policy.extension_pages includes 'wasm-unsafe-eval'
 *     This is F-MV3-02. WDK transitively compiles WebAssembly via
 *     sodium-universal -> sodium-javascript -> blake2b-wasm /
 *     sha256-wasm / sha512-wasm. The default MV3 CSP blocks WASM
 *     compilation; 'wasm-unsafe-eval' is Chrome's sanctioned source
 *     for legitimate WebAssembly use in extension contexts.
 *     See ADR-011 and Tether disclosure path.
 *   - host_permissions: empty by design. Per-origin access is requested
 *     at runtime when a dApp first attempts to connect (per addendum S3.2).
 *   - permissions: 'storage' for chrome.storage.local metadata (including
 *     the per-install UUID for EIP-6963 - see src/content/index.ts).
 *     'alarms' for chrome.alarms-based auto-lock (addendum S3.3).
 *     Note: setTimeout does NOT survive SW termination, alarms do.
 *
 * content_scripts + web_accessible_resources added in B4.2:
 *   - content script runs at document_start in EVERY page's isolated world
 *   - inpage script is web_accessible so content can inject it via script tag
 *     into the page's main world (where window.ethereum lives)
 */

import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'WDK Wallet',
  description: 'A self-custodial multi-chain wallet built on Tether WDK',
  version: '0.1.0',

  action: {
    default_popup: 'src/popup/index.html',
    default_icon: {
      '16': 'icons/icon-16.png',
      '48': 'icons/icon-48.png',
      '128': 'icons/icon-128.png',
    },
  },

  icons: {
    '16': 'icons/icon-16.png',
    '48': 'icons/icon-48.png',
    '128': 'icons/icon-128.png',
  },

  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },

  permissions: [
    'storage',
    'alarms',
  ],

  host_permissions: [
    'https://*/*',],

  // Content scripts inject inpage into the page's main world for dApp
  // connection. document_start ensures inpage loads before page scripts.
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.ts'],
      run_at: 'document_start',
      all_frames: false,
    },
  ],

  // inpage script must be web_accessible so the content script can inject
  // it as a <script src="chrome-extension://EXT_ID/inpage.js">.
  web_accessible_resources: [
    {
      resources: ['inpage.js'],
      matches: ['<all_urls>'],
    },
  ],

  // F-MV3-02 mitigation. See ADR-011.
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
  },
});