/**
 * useTonAccount - fetches the TON (v5r1) address and balance for a
 * (chain, accountIndex). Mirrors useBtcAccount: address first (so the dashboard
 * shows it immediately), balance fills in when the TON client returns. Gated by
 * `enabled` so MainView can call it unconditionally and only fetch on TON chains.
 */

import { useEffect, useState } from 'react';
import { send } from '../lib/sw-client.js';
import type { TonChainId } from '@wdk-starter/wdk-web-core/types';

export type TonAccountState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; address: string; balanceNano: bigint | null }
  | { status: 'error'; error: string };

export interface UseTonAccountOptions {
  readonly chain?: TonChainId;
  readonly accountIndex?: number;
  readonly enabled?: boolean;
}

export function useTonAccount(opts: UseTonAccountOptions = {}): { state: TonAccountState } {
  const enabled = opts.enabled ?? true;
  const chain: TonChainId = opts.chain ?? 'ton-mainnet';
  const accountIndex = opts.accountIndex ?? 0;
  const [state, setState] = useState<TonAccountState>({ status: 'idle' });

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });

    void (async () => {
      try {
        const address = await send({ type: 'ACCOUNT_GET_TON_ADDRESS', chain, accountIndex });
        if (cancelled) return;
        setState({ status: 'ready', address, balanceNano: null });
        try {
          const nano = await send({ type: 'ACCOUNT_GET_TON_BALANCE', chain, accountIndex });
          if (!cancelled) setState({ status: 'ready', address, balanceNano: BigInt(nano) });
        } catch {
          // balance read failed (e.g. blocked endpoint) — keep the address shown
        }
      } catch (err) {
        if (!cancelled) setState({ status: 'error', error: err instanceof Error ? err.message : String(err) });
      }
    })();

    return () => { cancelled = true; };
  }, [enabled, chain, accountIndex]);

  return { state };
}
