/**
 * @wdk-starter/wdk-web-core/worker/entry — Comlink bootstrap.
 *
 * Side-effect module imported by the worker host context (Browser
 * Extension MV3 SW, Next.js Template Web Worker). Constructs a default
 * WalletWorker and exposes it via Comlink so the consumer page or popup
 * can call methods as Promise-returning RPCs through Comlink.wrap.
 *
 * Browser Extension MV3 SW context: this file MUST be imported AFTER
 * polyfill-globals.ts (which assigns Buffer/process/global onto
 * globalThis - required by sodium-javascript and WDK before init).
 *
 * Example consumer (extension service worker):
 *
 *   import '@wdk-starter/wdk-web-core/polyfill-globals';
 *   import '@wdk-starter/wdk-web-core/worker/entry';
 *
 * Matching client-side import (extension popup or Next.js page):
 *
 *   import type { WalletWorker } from '@wdk-starter/wdk-web-core/worker';
 *   import * as Comlink from 'comlink';
 *   const worker = Comlink.wrap<WalletWorker>(endpoint);
 *   await worker.vault_load(password);
 *
 * The expose() call is guarded by a runtime check for self.postMessage so
 * the module can be imported in non-worker contexts (e.g. vitest's Node
 * environment) without crashing. In a real worker context, self is
 * WorkerGlobalScope or ServiceWorkerGlobalScope, both of which define
 * postMessage. In Node, self is undefined.
 */

import * as Comlink from 'comlink';
import { WalletWorker } from './wallet-worker.js';

const instance = new WalletWorker();

// Runtime guard: only Comlink.expose in actual worker host contexts.
const g = globalThis as unknown as { postMessage?: unknown };
if (typeof g.postMessage === 'function') {
  Comlink.expose(instance);
}

export {};