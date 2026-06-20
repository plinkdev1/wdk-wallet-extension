/**
 * useUsdValue - fetches the USD price for a symbol (via PRICING_GET_USD_PRICE →
 * CoinGecko in the worker) and returns the formatted USD value of a base-unit
 * amount, or null if the price or amount is unavailable.
 *
 * Used to show fiat values next to native balances. Network/unknown-symbol
 * failures resolve to null (the UI simply omits the fiat line).
 */

import { useEffect, useState } from 'react';
import { send } from '../lib/sw-client.js';

export function useUsdValue(symbol: string, baseAmount: bigint | null, decimals: number): string | null {
  const [price, setPrice] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const p = await send({ type: 'PRICING_GET_USD_PRICE', symbol });
        if (!cancelled) setPrice(p);
      } catch {
        if (!cancelled) setPrice(null);
      }
    })();
    return () => { cancelled = true; };
  }, [symbol]);

  if (price === null || baseAmount === null) return null;
  const human = Number(baseAmount) / 10 ** decimals;
  return (human * price).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
