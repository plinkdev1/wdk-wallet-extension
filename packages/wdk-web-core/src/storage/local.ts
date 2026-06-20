/**
 * Typed wrapper around chrome.storage.local for the WDK browser extension.
 *
 * Per PRD 01 Addendum §9.3. The runtime API (chrome.storage.local.{get,set,
 * remove,clear}) is only accessible inside MV3 extension contexts (SW,
 * popup, content scripts). Calling these from non-extension contexts
 * (e.g., the Next.js template Web Worker) throws an informative error.
 *
 * Phase 0 Test 09 empirically validated chrome.storage.local survives MV3
 * SW termination — the 86ms cold respawn includes the read round-trip.
 *
 * Security note (per addendum §9.4): chrome.storage.local is treated as
 * plaintext-equivalent. No raw key material is ever written via setLocal.
 * The encrypted vault blob lives in IndexedDB (ADR-002).
 *
 * IMPLEMENTATION NOTE: We intentionally do NOT depend on @types/chrome.
 * Adding @types/chrome to wdk-web-core's devDeps surfaces conflict in
 * downstream consumers that re-export from this package's root barrel
 * (e.g., Next.js template would need @types/chrome to typecheck against
 * the .d.ts surface, despite never using chrome at runtime). Instead, we
 * declare a minimal local type for chrome.storage.local and cast
 * globalThis once via the `chromeLocal()` helper. apps/extension has
 * its own @types/chrome dep for chrome.runtime, chrome.alarms, etc.
 */

import type { LocalStorageSchema } from './types.js';

/**
 * Minimal local type for chrome.storage.local. Kept narrow on purpose —
 * we only use the four methods below. Downstream consumers needing the
 * full chrome.* surface install @types/chrome themselves.
 */
type ChromeStorageLocal = {
  get(key: string): Promise<Record<string, unknown>>;
  set(entries: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
};

/**
 * Resolve chrome.storage.local at call time. Throws an informative error
 * if invoked outside an MV3 extension context (e.g., from the Next.js
 * template Worker, which uses IndexedDB for everything per ADR-002).
 */
function chromeLocal(): ChromeStorageLocal {
  const g = globalThis as { chrome?: { storage?: { local?: ChromeStorageLocal } } };
  const local = g.chrome?.storage?.local;
  if (!local) {
    throw new Error(
      'chrome.storage.local is not available in this context. The storage ' +
      'module is only usable inside MV3 extension contexts (service worker, ' +
      'popup, content script). Use IndexedDB directly for browser contexts ' +
      'outside an extension.'
    );
  }
  return local;
}

/**
 * Retrieve a single typed value from chrome.storage.local. Returns
 * undefined if the key has never been set.
 */
export async function getLocal<K extends keyof LocalStorageSchema>(
  key: K
): Promise<LocalStorageSchema[K] | undefined> {
  const result = await chromeLocal().get(key);
  return result[key] as LocalStorageSchema[K] | undefined;
}

/**
 * Write a single typed value to chrome.storage.local. Overwrites any
 * prior value at the same key.
 */
export async function setLocal<K extends keyof LocalStorageSchema>(
  key: K,
  value: LocalStorageSchema[K]
): Promise<void> {
  await chromeLocal().set({ [key]: value });
}

/**
 * Remove a single key from chrome.storage.local. Subsequent getLocal
 * calls for this key return undefined.
 */
export async function removeLocal<K extends keyof LocalStorageSchema>(
  key: K
): Promise<void> {
  await chromeLocal().remove(key);
}

/**
 * Clear all keys from chrome.storage.local. Used by uninstall cleanup
 * and "Reset wallet" UX flows. The extension is responsible for
 * re-populating defaults after a clear.
 */
export async function clearLocal(): Promise<void> {
  await chromeLocal().clear();
}