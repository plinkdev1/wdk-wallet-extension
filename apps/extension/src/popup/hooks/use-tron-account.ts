/**
 * useTronAccount - fetches the Tron address and balance for a
 * (chain, accountIndex). Mirrors useTonAccount: address first, balance fills in
 * when the TronGrid provider returns. Gated by `enabled` so MainView can call it
 * unconditionally and only fetch on Tron chains.
 */

import { useEffect, useState } from 'react';
import { send } from '../lib/sw-client.js';
import type { TronChainId } from '@wdk-starter/wdk-web-core/types';

export type TronAccountState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; address: string; balanceSun: bigint | null }
  | { status: 'error'; error: string };

export interface UseTronAccountOptions {
  readonly chain?: TronChainId;
  readonly accountIndex?: number;
  readonly enabled?: boolean;
}

export function useTronAccount(opts: UseTronAccountOptions = {}): { state: TronAccountState } {
  const enabled = opts.enabled ?? true;
  const chain: TronChainId = opts.chain ?? 'tron-mainnet';
  const accountIndex = opts.accountIndex ?? 0;
  const [state, setState] = useState<TronAccountState>({ status: 'idle' });

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });

    void (async () => {
      try {
        const address = await send({ type: 'ACCOUNT_GET_TRON_ADDRESS', chain, accountIndex });
        if (cancelled) return;
        setState({ status: 'ready', address, balanceSun: null });
        try {
          const sun = await send({ type: 'ACCOUNT_GET_TRON_BALANCE', chain, accountIndex });
          if (!cancelled) setState({ status: 'ready', address, balanceSun: BigInt(sun) });
        } catch {
          // balance read failed — keep the address shown
        }
      } catch (err) {
        if (!cancelled) setState({ status: 'error', error: err instanceof Error ? err.message : String(err) });
      }
    })();

    return () => { cancelled = true; };
  }, [enabled, chain, accountIndex]);

  return { state };
}
