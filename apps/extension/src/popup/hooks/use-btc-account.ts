/**
 * useBtcAccount - fetches the BIP-84 Bitcoin address (offline derivation) and
 * confirmed balance (via the Blockbook client) for a (chain, accountIndex).
 *
 * Address resolves first so the dashboard shows it immediately; the balance
 * fills in when the network read returns (and stays null if it fails, so a
 * blocked endpoint never hides the address). Gated by `enabled` so MainView can
 * call it unconditionally and only fetch on Bitcoin chains.
 */

import { useEffect, useState } from 'react';
import { send } from '../lib/sw-client.js';
import type { BtcChainId } from '@wdk-starter/wdk-web-core/types';

export type BtcAccountState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; address: string; balanceSats: bigint | null }
  | { status: 'error'; error: string };

export interface UseBtcAccountOptions {
  readonly chain?: BtcChainId;
  readonly accountIndex?: number;
  readonly enabled?: boolean;
}

export function useBtcAccount(opts: UseBtcAccountOptions = {}): { state: BtcAccountState } {
  const enabled = opts.enabled ?? true;
  const chain: BtcChainId = opts.chain ?? 'bitcoin-mainnet';
  const accountIndex = opts.accountIndex ?? 0;
  const [state, setState] = useState<BtcAccountState>({ status: 'idle' });

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });

    void (async () => {
      try {
        const address = await send({ type: 'ACCOUNT_GET_BTC_ADDRESS', chain, accountIndex });
        if (cancelled) return;
        setState({ status: 'ready', address, balanceSats: null });
        try {
          const sats = await send({ type: 'ACCOUNT_GET_BTC_BALANCE', chain, accountIndex });
          if (!cancelled) setState({ status: 'ready', address, balanceSats: BigInt(sats) });
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
