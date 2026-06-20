/**
 * useTokenBalances - one-shot fetch of the configured token balances (USDt,
 * XAUt, ...) for a (chain, address) pair via RPC_GET_TOKEN_BALANCE.
 *
 * Mirrors useBalance: pass undefined address while it resolves (the hook stays
 * idle), and a real address to fetch. Errors per token are swallowed to a
 * null balance so one failing token doesn't blank the others.
 */

import { useEffect, useState } from 'react';
import type { EvmChainId } from '@wdk-starter/wdk-web-core/types';
import { send } from '../lib/sw-client.js';
import { tokensFor, type TokenInfo } from '../lib/tokens.js';

export interface TokenBalance {
  readonly token: TokenInfo;
  /** Balance in base units, or null if the read failed. */
  readonly balance: bigint | null;
}

export type TokenBalancesState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; balances: readonly TokenBalance[] };

export interface UseTokenBalancesOptions {
  readonly chain?: EvmChainId;
  readonly address?: string;
}

export function useTokenBalances(opts: UseTokenBalancesOptions): { state: TokenBalancesState } {
  const { chain, address } = opts;
  const [state, setState] = useState<TokenBalancesState>({ status: 'idle' });

  useEffect(() => {
    if (!chain || !address) {
      setState({ status: 'idle' });
      return;
    }
    const tokens = tokensFor(chain);
    if (tokens.length === 0) {
      setState({ status: 'ready', balances: [] });
      return;
    }

    let cancelled = false;
    setState({ status: 'loading' });

    void (async () => {
      const balances = await Promise.all(
        tokens.map(async (token): Promise<TokenBalance> => {
          try {
            const raw = await send({ type: 'RPC_GET_TOKEN_BALANCE', chain, address, tokenAddress: token.address });
            return { token, balance: BigInt(raw) };
          } catch {
            return { token, balance: null };
          }
        }),
      );
      if (!cancelled) setState({ status: 'ready', balances });
    })();

    return () => { cancelled = true; };
  }, [chain, address]);

  return { state };
}
