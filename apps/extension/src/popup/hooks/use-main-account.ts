/**
 * useMainAccount - one-shot poll of ACCOUNT_GET_EVM_ADDRESS for a default
 * (chain, accountIndex) pair.
 *
 * v0.1: hardcoded chain = ethereum (the SupportedChainId key matching CHAIN_LOADERS), accountIndex = 0. The options
 * object exists from day one so v0.2's chain picker + multi-account
 * support can flow values in without changing the hook signature.
 *
 * Returns a discriminated-union state (loading | ready | error) and a
 * refresh() that re-runs the fetch. Pattern matches useVaultState and
 * useApprovalQueue: one-shot poll, no setInterval, refresh() bumps an
 * internal key.
 *
 * MainView is only mounted when the wallet is unlocked (per the routing
 * chain App -> UnlockedRouter -> MainView), so ACCOUNT_GET_EVM_ADDRESS
 * will always have a usable worker. Edge case: if the wallet auto-locks
 * (ADR-006) while MainView is mounted, the next address fetch will
 * throw - error state surfaces that, and eventually the vault-state
 * refresh elsewhere will re-route to UnlockView.
 */

import { useEffect, useState } from 'react';
import { send } from '../lib/sw-client.js';
import type { EvmChainId } from '@wdk-starter/wdk-web-core/types';

export type MainAccountState =
  | { status: 'loading' }
  | { status: 'ready'; address: string }
  | { status: 'error'; error: string };

export interface UseMainAccountOptions {
  readonly chain?: EvmChainId;
  readonly accountIndex?: number;
}

export interface UseMainAccountResult {
  readonly state: MainAccountState;
  /** Re-fetch the address. Call after a chain switch or account change. */
  readonly refresh: () => void;
}

export function useMainAccount(opts: UseMainAccountOptions = {}): UseMainAccountResult {
  const chain: EvmChainId = opts.chain ?? 'ethereum';
  const accountIndex: number = opts.accountIndex ?? 0;

  const [state, setState] = useState<MainAccountState>({ status: 'loading' });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    void (async () => {
      try {
        const address = await send({
          type: 'ACCOUNT_GET_EVM_ADDRESS',
          chain,
          accountIndex,
        });
        if (cancelled) return;
        setState({ status: 'ready', address });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setState({ status: 'error', error: message });
      }
    })();

    return () => { cancelled = true; };
  }, [refreshKey, chain, accountIndex]);

  return {
    state,
    refresh: () => setRefreshKey((k) => k + 1),
  };
}