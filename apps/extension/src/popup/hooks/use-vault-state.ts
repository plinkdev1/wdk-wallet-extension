/**
 * useVaultState - one-shot poll of (vault-exists, lock-state) on mount.
 *
 * Flow on mount (and on refresh()):
 *   1. Promise.all([VAULT_HAS_STORED, GET_LOCK_STATE]) -> [boolean, 'locked'|'unlocked']
 *   2. If !hasStored                     -> status: 'no-vault'
 *   3. Else if lockState === 'locked'    -> status: 'locked'
 *   4. Else                              -> status: 'unlocked'
 *   5. On any error                      -> status: 'error' with message
 *
 * One-shot poll (no setInterval) - same pattern as useApprovalQueue. The
 * popup is short-lived; the user opens it, the hook fires once, the popup
 * routes. refresh() bumps an internal key to re-run the effect; called by
 * UnlockView after VAULT_LOAD succeeds (so the app transitions from
 * 'locked' to 'unlocked') and by CreateVaultView after successful vault
 * creation (so the app transitions from 'no-vault' to 'unlocked').
 *
 * Per ADR-006 the lock state is the source of truth for "is the wallet
 * usable right now". The vault-exists check is a separate question - the
 * vault can exist on disk but the in-memory key is gone after SW restart
 * or explicit lock. Hence the two-query union.
 */

import { useEffect, useState } from 'react';
import { send } from '../lib/sw-client.js';

export type VaultState =
  | { status: 'loading' }
  | { status: 'no-vault' }
  | { status: 'locked' }
  | { status: 'unlocked' }
  | { status: 'error'; error: string };

export interface UseVaultStateResult {
  readonly state: VaultState;
  /** Re-fetch (vault-exists, lock-state). Call after VAULT_LOAD / VAULT_STORE / LOCK. */
  readonly refresh: () => void;
}

export function useVaultState(): UseVaultStateResult {
  const [state, setState] = useState<VaultState>({ status: 'loading' });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    void (async () => {
      try {
        const [hasStored, lockState] = await Promise.all([
          send({ type: 'VAULT_HAS_STORED' }),
          send({ type: 'GET_LOCK_STATE' }),
        ]);
        if (cancelled) return;
        if (!hasStored) {
          setState({ status: 'no-vault' });
        } else if (lockState === 'locked') {
          setState({ status: 'locked' });
        } else {
          setState({ status: 'unlocked' });
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setState({ status: 'error', error: message });
      }
    })();

    return () => { cancelled = true; };
  }, [refreshKey]);

  return {
    state,
    refresh: () => setRefreshKey((k) => k + 1),
  };
}