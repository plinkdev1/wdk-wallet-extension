/**
 * useGasless — exposes whether ERC-4337 gasless execution is available (a
 * bundler is configured) and a toggle for it. DeFi views (lending/swap/bridge)
 * use it to optionally route a protocol action through the smart account so the
 * user pays no native gas (gas is sponsored / paid in USDt via the paymaster).
 */
import { useEffect, useState } from 'react';
import { send } from '../lib/sw-client.js';

export interface UseGaslessResult {
  /** True when a bundler is configured (gasless is possible). */
  readonly available: boolean;
  /** Whether the user has opted into gasless for the next action. */
  readonly gasless: boolean;
  readonly setGasless: (v: boolean) => void;
}

export function useGasless(): UseGaslessResult {
  const [available, setAvailable] = useState(false);
  const [gasless, setGasless] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const ok = await send({ type: 'ERC4337_IS_CONFIGURED' });
        if (!cancelled) setAvailable(ok);
      } catch {
        /* not configured — leave unavailable */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { available, gasless, setGasless };
}
