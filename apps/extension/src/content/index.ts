/**
 * Content script entry. Runs in EVERY web page's isolated world (matching the
 * manifest.config.ts content_scripts match pattern, which is <all_urls>). The
 * isolated world means: same DOM access as the page, but a separate JS context,
 * so page scripts can't tamper with this code's variables.
 *
 * Three jobs:
 *   1. Inject the inpage script into the page's MAIN world so it can register
 *      window.ethereum + EIP-6963 announcement (which requires main-world access).
 *      Inject happens at document_start (before page scripts run), with the
 *      per-install UUID embedded in the script's dataset attribute.
 *   2. Bridge: listen on window for inpage's postMessage DappRequestEnvelopes,
 *      stamp verified origin (F-SEC-01 propagation), forward to SW via
 *      chrome.runtime.sendMessage, post the response back to inpage via
 *      window.postMessage.
 *   3. UUID management: read the per-install UUID from chrome.storage.local on
 *      init. Lazy-init: if absent, generate via crypto.randomUUID() and store.
 *      Subsequent loads (other pages, other dApps) get the same UUID.
 *
 * SECURITY (F-SEC-01 propagation at the dApp tier):
 *   This script is the trust boundary. Inpage runs in main world (untrusted -
 *   page scripts can read/tamper). Content runs in isolated world (trusted to
 *   read window.location.origin correctly). The bridge stamps the origin from
 *   getOrigin() onto the outgoing envelope; the SW relies on it being honest.
 *
 * Per PRD 01 Addendum S12.6.3 + S12.6.4 + S12.6.5.
 */

import { createBridge } from './bridge.js';
import { injectInpage } from './inject.js';
import { startEventReceiver } from './event-receiver.js';
import type {
  DappSwRequestEnvelope, DappSwResponseEnvelope,
} from '../types/dapp-messages.js';

const UUID_STORAGE_KEY = 'wdk-install-uuid';

/**
 * Lazy-init the per-install UUID. Stored at chrome.storage.local. First page
 * load after install generates one and persists. Subsequent loads reuse it.
 *
 * Race-condition note: if two tabs first-load simultaneously, both may write
 * a different UUID. chrome.storage.local is last-write-wins; the surviving
 * UUID is used. This is acceptable because the UUID is purely an
 * EIP-6963-identity hint - no security property depends on it being unique
 * across early-install races. SW-managed init (in a later commit) would
 * eliminate this entirely.
 */
async function getOrCreateInstallUuid(): Promise<string> {
  const stored = await chrome.storage.local.get(UUID_STORAGE_KEY);
  const existing = stored[UUID_STORAGE_KEY];
  if (typeof existing === 'string' && existing.length > 0) {
    return existing;
  }
  const fresh = crypto.randomUUID();
  await chrome.storage.local.set({ [UUID_STORAGE_KEY]: fresh });
  return fresh;
}

/**
 * Send a DappSwRequestEnvelope to the SW via chrome.runtime.sendMessage and
 * unwrap the outer { ok, data | error } response envelope into the inner
 * DappSwResponseEnvelope shape the bridge expects.
 */
async function sendToSw(msg: DappSwRequestEnvelope): Promise<DappSwResponseEnvelope> {
  const outer = await chrome.runtime.sendMessage(msg) as
    | { ok: true; data: { result?: unknown; error?: { code: number; message: string } } }
    | { ok: false; error: string };

  if (outer && outer.ok === true) {
    const inner = outer.data;
    return {
      id: msg.id,
      ...(inner.result !== undefined ? { result: inner.result } : {}),
      ...(inner.error ? { error: inner.error } : {}),
    };
  }
  // ok: false - outer dispatcher error (e.g., unknown message type). Map to EIP-1474 -32603.
  const errMsg = (outer && outer.ok === false) ? outer.error : 'SW response malformed';
  return {
    id: msg.id,
    error: { code: -32603, message: errMsg },
  };
}

async function init(): Promise<void> {
  const uuid = await getOrCreateInstallUuid();

  injectInpage({
    getURL: (path: string) => chrome.runtime.getURL(path),
    uuid,
    icon: chrome.runtime.getURL('icons/icon-128.png'),
});

  const handle = createBridge({
    getOrigin: () => window.location.origin,
    sendToSw,
    postToInpage: (env) => window.postMessage(env, '*'),
  });

  // EventListener tolerates Promise-returning handlers (just ignores the return).
  window.addEventListener('message', handle as unknown as EventListener);

  // B4.9a: SW->content->inpage event push for EIP-1193 events (chainChanged,
  // accountsChanged, connect, disconnect). Receiver checks each event's
  // targetOrigin against window.location.origin and forwards matching events
  // to inpage via window.postMessage.
  startEventReceiver({
    currentOrigin: () => window.location.origin,
    postToInpage: (env) => window.postMessage(env, '*'),
  });
}

init().catch((err) => {
  // Surface init failures to the extension's console without crashing the
  // page. Failures here mean the wallet won't work on this page, which is
  // already obvious to the user attempting to connect.
  // eslint-disable-next-line no-console
  console.error('[wdk content] init failed:', err);
});

export {};