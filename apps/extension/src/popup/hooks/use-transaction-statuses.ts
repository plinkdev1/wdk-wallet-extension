/**
 * useTransactionStatuses - real-time on-chain status monitoring for the
 * Activity tab. For each non-final transaction it polls RPC_GET_TRANSACTION_STATUS
 * (worker → RPC adapter: EVM receipt / Solana signature status), reflects the
 * live result, and persists resolved ('success' | 'failed') statuses so they
 * stick across popup reopens. Pending transactions are re-polled on an interval;
 * polling stops once everything is resolved or the view unmounts.
 */

import { useEffect, useRef, useState } from 'react';
import { send } from '../lib/sw-client.js';
import type { ChainId } from '@wdk-starter/wdk-web-core/types';
import { updateTransactionStatus, type TxRecord } from './use-transactions.js';

export type LiveStatus = 'pending' | 'success' | 'failed';

const POLL_INTERVAL_MS = 10_000;

function isFinal(s: LiveStatus | undefined): boolean {
  return s === 'success' || s === 'failed';
}

export function useTransactionStatuses(transactions: readonly TxRecord[]): Record<string, LiveStatus> {
  const [statuses, setStatuses] = useState<Record<string, LiveStatus>>({});
  const statusesRef = useRef<Record<string, LiveStatus>>({});

  // Re-arm when the set of not-yet-final transactions changes.
  const pollableKey = transactions
    .filter((t) => t.status !== 'success' && t.status !== 'failed')
    .map((t) => `${t.chain}:${t.hash}`)
    .join(',');

  useEffect(() => {
    const targets = transactions.filter((t) => t.status !== 'success' && t.status !== 'failed');
    if (targets.length === 0) return;
    let cancelled = false;

    const pollOnce = async (): Promise<void> => {
      await Promise.all(
        targets.map(async (t) => {
          if (isFinal(statusesRef.current[t.hash])) return;
          try {
            const status = await send({ type: 'RPC_GET_TRANSACTION_STATUS', chain: t.chain as ChainId, hash: t.hash });
            if (cancelled) return;
            statusesRef.current = { ...statusesRef.current, [t.hash]: status };
            setStatuses(statusesRef.current);
            if (isFinal(status)) updateTransactionStatus(t.hash, status);
          } catch {
            // transient — retry on the next tick
          }
        }),
      );
    };

    void pollOnce();
    const id = setInterval(() => { void pollOnce(); }, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [pollableKey]);

  return statuses;
}
