/**
 * @wdk-starter/wdk-ui - useActiveChain hook
 *
 * Generic active-chain state persisted to localStorage. Consumer passes the
 * supported chain id list; the hook is type-generic over T extends string so
 * downstream apps can use their own chain-id union (e.g. EvmChainId, ChainId,
 * or any custom subset) without wdk-ui needing to import wdk-web-core's
 * runtime registry.
 *
 * Storage key: 'wdk-active-chain-v1'.
 *
 * Validation:
 *   - On read, stored value is checked against the supported list. If it is
 *     not a known id (e.g. localStorage poisoning after a chain rename or
 *     downstream chain-list change), we fall back to the default.
 *   - On write (setChain), the value is trusted because the API surface is
 *     typed to accept only T.
 *
 * Source: B1b chain UI surface. Pairs with ChainSelector for the picker UI.
 */

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'wdk-active-chain-v1';

export interface UseActiveChainOptions<T extends string> {
  readonly supported: ReadonlyArray<T>;
  readonly default?: T;
}

function loadStored<T extends string>(supported: ReadonlyArray<T>, fallback: T): T {
  if (typeof window === 'undefined' || !window.localStorage) return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw && (supported as ReadonlyArray<string>).includes(raw)) {
      return raw as T;
    }
  } catch {
    // ignore privacy/quota errors
  }
  return fallback;
}

function saveStored(value: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try { window.localStorage.setItem(STORAGE_KEY, value); } catch { /* ignore */ }
}

/** Public for testability / consumer reset surfaces. */
export function clearStoredActiveChain(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

/**
 * Returns [activeChain, setActiveChain]. Default is options.default ??
 * options.supported[0]. Throws if supported is empty.
 */
export function useActiveChain<T extends string>(
  options: UseActiveChainOptions<T>
): [T, (next: T) => void] {
  if (options.supported.length === 0) {
    throw new Error('[useActiveChain] supported chain list cannot be empty');
  }
  const fallback = (options.default ?? options.supported[0]) as T;

  const [chain, setChain] = useState<T>(() => loadStored(options.supported, fallback));

  useEffect(() => {
    saveStored(chain);
  }, [chain]);

  const setChainSafe = useCallback((next: T) => {
    setChain(next);
  }, []);

  return [chain, setChainSafe];
}