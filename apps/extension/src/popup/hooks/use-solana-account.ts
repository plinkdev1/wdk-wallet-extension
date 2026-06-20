/**
 * useSolanaAccount - one-shot fetch of the base58 Solana address for a
 * (chain, accountIndex) pair via ACCOUNT_GET_SOLANA_ADDRESS.
 *
 * Mirrors useMainAccount, but is gated by `enabled` so MainView can call it
 * unconditionally (rules of hooks) and only fetch when a Solana chain is
 * active. Disabled → idle, no message sent.
 */

import { useEffect, useState } from 'react';
import { send } from '../lib/sw-client.js';
import type { SolanaChainId } from '@wdk-starter/wdk-web-core/types';

export type SolanaAccountState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; address: string }
  | { status: 'error'; error: string };

export interface UseSolanaAccountOptions {
  readonly chain?: SolanaChainId;
  readonly accountIndex?: number;
  readonly enabled?: boolean;
}

export interface UseSolanaAccountResult {
  readonly state: SolanaAccountState;
  readonly refresh: () => void;
}

export function useSolanaAccount(opts: UseSolanaAccountOptions = {}): UseSolanaAccountResult {
  const enabled = opts.enabled ?? true;
  const chain: SolanaChainId = opts.chain ?? 'solana-mainnet';
  const accountIndex = opts.accountIndex ?? 0;

  const [state, setState] = useState<SolanaAccountState>({ status: 'idle' });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });

    void (async () => {
      try {
        const address = await send({ type: 'ACCOUNT_GET_SOLANA_ADDRESS', chain, accountIndex });
        if (!cancelled) setState({ status: 'ready', address });
      } catch (err) {
        if (!cancelled) setState({ status: 'error', error: err instanceof Error ? err.message : String(err) });
      }
    })();

    return () => { cancelled = true; };
  }, [enabled, chain, accountIndex, refreshKey]);

  return { state, refresh: () => setRefreshKey((k) => k + 1) };
}
