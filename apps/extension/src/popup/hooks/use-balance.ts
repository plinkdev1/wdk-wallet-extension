/**
 * useBalance - one-shot poll of RPC_GET_BALANCE for a given (chain, address).
 *
 * v0.1: defaults to chain = 'ethereum'. Address is required to fetch - pass
 * undefined while the parent's address resolves and the hook stays in loading
 * state. When address transitions from undefined to defined, the useEffect
 * fires and the balance fetches.
 *
 * Pattern mirrors useMainAccount: discriminated-union state (loading | ready
 * | error), refresh() bumps an internal key, cancelled flag guards the
 * useEffect against late resolutions on unmount/re-fetch.
 *
 * Companion utility formatEthFromWei truncates a wei bigint to fixed 4-decimal
 * ETH string for display. v0.1 hardcoded to ETH 18-decimal precision; v0.2
 * will introduce chain-aware decimal lookup (Solana 9, others vary).
 *
 * Source: PRD Step 10 RPC adapter + B6 MainView balance display scope.
 */

import { useEffect, useState } from 'react';
import { send } from '../lib/sw-client.js';
import type { ChainId } from '@wdk-starter/wdk-web-core/types';

export type BalanceState =
  | { status: 'loading' }
  | { status: 'ready'; balance: bigint }
  | { status: 'error'; error: string };

export interface UseBalanceOptions {
  /** Chain to fetch balance on. Default 'ethereum'. */
  readonly chain?: ChainId;
  /** Address to fetch balance for. When undefined the hook stays in loading state. */
  readonly address?: string;
}

export interface UseBalanceResult {
  readonly state: BalanceState;
  /** Re-fetch the balance. Call after a chain switch, account change, or tx broadcast. */
  readonly refresh: () => void;
}

export function useBalance(opts: UseBalanceOptions = {}): UseBalanceResult {
  const chain: ChainId = opts.chain ?? 'ethereum';
  const address = opts.address;

  const [state, setState] = useState<BalanceState>({ status: 'loading' });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!address) {
      setState({ status: 'loading' });
      return;
    }

    let cancelled = false;
    setState({ status: 'loading' });

    void (async () => {
      try {
        const balanceRaw = await send({
          type: 'RPC_GET_BALANCE',
          chain,
          address,
        });
        if (cancelled) return;
        setState({ status: 'ready', balance: BigInt(balanceRaw) });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setState({ status: 'error', error: message });
      }
    })();

    return () => { cancelled = true; };
  }, [refreshKey, chain, address]);

  return {
    state,
    refresh: () => setRefreshKey((k) => k + 1),
  };
}

/**
 * Format a wei bigint as a fixed-4-decimal ETH string. Truncates (not rounds).
 *
 * v0.1: hardcoded ETH 18-decimal precision. v0.2 will accept a decimals param
 * for chain-aware formatting (Solana SOL = 9, native L2 tokens vary).
 *
 * @example
 *   formatEthFromWei(0n)                  // "0.0000"
 *   formatEthFromWei(10n ** 18n)          // "1.0000"  (1 ETH)
 *   formatEthFromWei(10n ** 17n)          // "0.1000"  (0.1 ETH)
 *   formatEthFromWei(1234n * 10n ** 14n)  // "0.1234"
 *   formatEthFromWei(12345n * 10n ** 13n) // "0.1234"  (truncates 5th decimal)
 */
export function formatEthFromWei(wei: bigint): string {
  const ETH = 10n ** 18n;
  const whole = wei / ETH;
  const remainder = wei % ETH;
  // 4-decimal precision: shift remainder up by 10000, divide by ETH, pad-left
  const tenThousandths = (remainder * 10000n) / ETH;
  return `${whole}.${tenThousandths.toString().padStart(4, '0')}`;
}