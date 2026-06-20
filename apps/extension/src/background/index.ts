/**
 * MV3 service worker entry.
 *
 * Architecture (B4.6 state):
 *
 *   chrome.runtime.onMessage
 *       |
 *       v  autoLock.onActivity() resets idle timer
 *   dispatch (F-SEC-01 outer tier)
 *       |
 *       v
 *   handlers (createSwHandlers)
 *       |
 *       +-> engine (lock state machine)
 *       +-> worker (WDK orchestrator + vault)
 *       +-> approvalFlow (pending dApp approval state)
 *       +-> connectionState (per-origin allow-list, chrome.storage.local persisted) [B4.6]
 *       +-> dappDispatch (F-SEC-01 inner tier - EIP-1193 method router)
 *               |
 *               +-> eth_chainId / eth_accounts / eth_requestAccounts (B4.6 real impls)
 *               +-> personal_sign / etc. (B4.7+ stubs)
 *
 *   chrome.alarms (every 1 min) -> autoLock.checkIdle() -> engine.lock() + approvalFlow.cancelAll()
 *   chrome.runtime.onConnect ('wdk-events' ports) -> engine.onLockStateChange -> port.postMessage
 *
 * Listener registration MUST happen synchronously at module top level. PRD 01 Addendum 2.2.
 * connectionState.load() fires after listener registration (async fire-and-forget) so
 * the state is hot by the time user-initiated dApp requests arrive.
 */

import './polyfill-document.js';
import '@wdk-starter/wdk-web-core/polyfill-globals';
import { WalletWorker } from '@wdk-starter/wdk-web-core/worker';
import { createExtensionRpcAdapter } from './rpc-adapter.js';

import { createDispatcher } from './dispatch.js';
import { createEngine } from './engine.js';
import { createSwHandlers } from './handlers.js';
import { createApprovalFlow } from './approval-flow.js';
import { createConnectionState } from './connection-state.js';
import { createBrowserDappEventBus } from './dapp-event-bus.js';
import {
  createAutoLock,
  registerAutoLockAlarm,
  createOnConnectHandler,
} from './lifecycle.js';

console.log('[bg] WDK Wallet SW booting - B4.9b: + wallet_switchEthereumChain + chainChanged event push');

const engine = createEngine();

// MoonPay on-ramp config — app-supplied publishable key (Vite statically inlines
// these at build). Absent key => the on-ramp UI shows a "configure" notice; the
// integration is fully present and activates the moment a key is provided.
const moonpayApiKey = import.meta.env.VITE_MOONPAY_API_KEY;
const moonpayConfig = moonpayApiKey
  ? {
      apiKey: moonpayApiKey,
      environment: (import.meta.env.VITE_MOONPAY_ENV === 'production' ? 'production' : 'sandbox') as 'production' | 'sandbox',
      ...(import.meta.env.VITE_MOONPAY_SIGN_URL ? { signUrl: import.meta.env.VITE_MOONPAY_SIGN_URL } : {}),
    }
  : undefined;

const worker = new WalletWorker({ rpcAdapter: createExtensionRpcAdapter(), ...(moonpayConfig ? { moonpayConfig } : {}) });
const approvalFlow = createApprovalFlow();
const connectionState = createConnectionState();
const eventBus = createBrowserDappEventBus();

const autoLock = createAutoLock(engine, { idleMinutes: 5 });
const dispatch = createDispatcher(createSwHandlers({ engine, worker, approvalFlow, connectionState, eventBus }));

// SYNCHRONOUS top-level registration - F-MV3-01 invariant.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  autoLock.onActivity();

  (async () => {
    try {
      const data = await dispatch(message);
      sendResponse({ ok: true, data });
    } catch (err) {
      sendResponse({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  })();
  return true;
});

registerAutoLockAlarm(autoLock);

// B1c: chrome.storage.onChanged listener - react when popup changes prefs:autoLockMinutes.
// The popup writes directly to chrome.storage.local (see use-auto-lock-minutes hook).
// We listen here for the change event and push it to the live autoLock state machine.
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  const change = changes['prefs:autoLockMinutes'];
  if (!change) return;
  const next = change.newValue;
  if (typeof next === 'number' && Number.isFinite(next) && next >= 0) {
    autoLock.setIdleMinutes(next);
    console.log('[bg] autoLockMinutes updated to', next, next === 0 ? '(Never)' : '');
  }
});
chrome.runtime.onConnect.addListener(createOnConnectHandler(engine));

// B4.6: fire-and-forget load of connection state. User-initiated dApp requests
// take >> chrome.storage round-trip so the state is hot by the time it's queried.
// Per-method handlers also call connectionState.load() (idempotent) so a race
// between SW startup and a very-fast first request is safely covered.
void connectionState.load().catch((err) => {
  console.error('[bg] connectionState.load() failed:', err);
});

// A2 - G1: hydrate idle threshold from user preference. Default (5) is set
// in createAutoLock above to match STORAGE_DEFAULTS['prefs:autoLockMinutes'];
// this async load applies any user override via setIdleMinutes. Mirrors the
// connectionState.load() fire-and-forget pattern.
void chrome.storage.local.get('prefs:autoLockMinutes').then((r) => {
  const stored = (r as Record<string, unknown>)['prefs:autoLockMinutes'];
  if (typeof stored === 'number' && Number.isFinite(stored) && stored > 0) {
    autoLock.setIdleMinutes(stored);
  }
}).catch((err) => {
  console.error('[bg] failed to load prefs:autoLockMinutes:', err);
});

export {};