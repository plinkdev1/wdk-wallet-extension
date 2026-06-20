/**
 * Side-effect polyfill module — assigns Buffer / process / global onto
 * globalThis. Importing this module as a side effect (no named bindings)
 * is the activation:
 *
 *     import '@wdk-starter/wdk-web-core/polyfill-globals';
 *
 * ES module evaluation order guarantees this module body runs before any
 * subsequent import is evaluated, including the WDK module tree which
 * depends on Buffer being available on globalThis at module-load time
 * (F-BIP39-01: bip39.mnemonicToEntropy calls Buffer.from, and its
 * try/catch silently swallows the ReferenceError into a false return,
 * cascading into a misleading "Invalid seed" error from WDK).
 *
 * MUST be the FIRST import in any MV3 service worker entry that loads
 * WDK. Required because @crxjs/vite-plugin compiles the SW as its own
 * rollup entry, and vite-plugin-node-polyfills' chunk-injection hook
 * does not visit that entry (F-MV3-01). See ADR-011.
 *
 * Next.js / Vite consumers typically do NOT import this directly. Their
 * build-config-level polyfills (webpack.ProvidePlugin for Next.js,
 * vite-plugin-node-polyfills for Vite) cover the same surface
 * transparently across the main thread and dedicated Web Worker chunks
 * (ADR-008).
 *
 * Verbatim port from Phase 0 commit 7c297b2 of
 * github.com/plinkdev1/wdk-phase0-validation at
 * apps/extension/src/polyfill-globals.ts, where it was empirically
 * validated by Test 09 (MV3 service worker bootstrap, 86ms cold init).
 */

import { Buffer } from 'buffer';
import process from 'process';

(globalThis as { Buffer?: typeof Buffer }).Buffer = Buffer;
(globalThis as { process?: typeof process }).process = process;
(globalThis as { global?: typeof globalThis }).global = globalThis;

// MV3 SW lacks `document`. WDK's EVM wallet-manager dependency tree
// references the bare `document` identifier somewhere (likely a DOM
// detection that uses bare `document` instead of `typeof document`),
// throwing ReferenceError in the SW context. Minimal stub: empty
// object so property reads return undefined silently. WDK's try/catch
// patterns (see F-BIP39-01) handle that. The typeof guard ensures we
// don't clobber the real `document` if this module is ever imported
// into a tab/popup context.
// F-MV3-03 (Phase 1, B3.4c). Symmetric to F-MV3-01's Buffer/process pattern.
if (typeof (globalThis as { document?: unknown }).document === 'undefined') {
  (globalThis as { document?: unknown }).document = {};
}

export {};