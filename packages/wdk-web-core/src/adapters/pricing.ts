/**
 * @wdk-starter/wdk-web-core/adapters/pricing
 *
 * USD spot-price adapters, mirroring the rpc/indexer adapter pattern: one
 * {@link PricingAdapter} interface, pluggable sources, and a fallback chain.
 *
 * Pricing is public (no key material), so it needs no worklet boundary — but
 * the worker exposes `pricing_getUsdPrice` for UI convenience and now drives it
 * through an injectable adapter, so a product can choose its source(s) and gain
 * resilience (a single source going down no longer means no prices).
 *
 * Sources shipped:
 *  - **Bitfinex** ({@link createBitfinexPricingAdapter}): direct public-ticker
 *    HTTP, no dependency. Bitfinex is part of the Tether / iFinex group, so it
 *    is the natural Tether-aligned **primary**.
 *  - **CoinGecko** ({@link createCoingeckoPricingAdapter}): wraps
 *    `@tetherto/wdk-pricing-coingecko-http` (broad long-tail coverage) — the
 *    recommended fallback.
 *  - **Fallback chain** ({@link createFallbackPricingAdapter}): primary →
 *    optional fallbacks; first non-null price wins.
 *  - **Mock** ({@link createMockPricingAdapter}): in-memory, no network.
 */

import { CoingeckoPricingClient } from '@tetherto/wdk-pricing-coingecko-http';

/** A USD spot-price source. Returns `null` when the symbol is unknown or the source is unavailable. */
export interface PricingAdapter {
  /** USD spot price for a ticker symbol (e.g. 'BTC', 'ETH'); `null` if unknown/unavailable. */
  getUsdPrice(symbol: string): Promise<number | null>;
}

/** In-memory mock. No network. Symbol lookup is case-insensitive. */
export function createMockPricingAdapter(prices: Readonly<Record<string, number>> = {}): PricingAdapter {
  const upper: Record<string, number> = {};
  for (const [k, v] of Object.entries(prices)) upper[k.toUpperCase()] = v;
  return {
    async getUsdPrice(symbol) {
      const v = upper[symbol.toUpperCase()];
      return typeof v === 'number' ? v : null;
    },
  };
}

export interface CoingeckoPricingOptions {
  /** Symbol → CoinGecko id overrides, merged onto the client's built-in defaults. */
  readonly coinIds?: Record<string, string>;
  /** CoinGecko API key (Demo or Pro; the host selects the header). */
  readonly apiKey?: string;
  /** API base URL (use the Pro host with a Pro key). */
  readonly baseURL?: string;
}

/** Wraps the WDK CoinGecko client behind {@link PricingAdapter}; errors resolve to `null`. */
export function createCoingeckoPricingAdapter(options: CoingeckoPricingOptions = {}): PricingAdapter {
  const client = new CoingeckoPricingClient({
    ...(options.coinIds ? { coinIds: options.coinIds } : {}),
    ...(options.apiKey ? { apiKey: options.apiKey } : {}),
    ...(options.baseURL ? { baseURL: options.baseURL } : {}),
  });
  return {
    async getUsdPrice(symbol) {
      try {
        return await client.getCurrentPrice(symbol, 'usd');
      } catch {
        return null;
      }
    },
  };
}

export interface BitfinexPricingOptions {
  /**
   * Symbol → Bitfinex trading pair (the part after the leading `t`). Merged onto
   * the built-in defaults. Bitfinex uses `BTCUSD` for short symbols and the
   * colon form `XAUT:USD` for longer ones; an unmapped symbol returns `null`.
   */
  readonly symbolMap?: Record<string, string>;
  /** Ticker API base (default the public host). */
  readonly baseUrl?: string;
  /** Injectable fetch (tests / non-browser). */
  readonly fetchImpl?: typeof fetch;
}

/** Conservative defaults — pairs we are confident about. Extend via `symbolMap`. */
const DEFAULT_BITFINEX_PAIRS: Readonly<Record<string, string>> = {
  BTC: 'BTCUSD',
  ETH: 'ETHUSD',
  SOL: 'SOLUSD',
  TRX: 'TRXUSD',
  USDT: 'UST:USD',
  XAUT: 'XAUT:USD',
};

/**
 * Bitfinex public-ticker price source (Tether-aligned primary). Maps a symbol to
 * a trading pair and reads `LAST_PRICE` (index 6) from the ticker array. Any
 * failure (unmapped symbol, non-OK response, unexpected shape) resolves to
 * `null` so a fallback chain can take over.
 */
export function createBitfinexPricingAdapter(options: BitfinexPricingOptions = {}): PricingAdapter {
  const base = (options.baseUrl ?? 'https://api-pub.bitfinex.com/v2').replace(/\/+$/, '');
  const pairs: Record<string, string> = { ...DEFAULT_BITFINEX_PAIRS, ...(options.symbolMap ?? {}) };
  const doFetch = options.fetchImpl ?? (globalThis.fetch as typeof fetch | undefined);
  return {
    async getUsdPrice(symbol) {
      const pair = pairs[symbol.toUpperCase()];
      if (pair === undefined || typeof doFetch !== 'function') return null;
      try {
        const res = await doFetch(`${base}/ticker/t${pair}`);
        if (!res.ok) return null;
        const data = (await res.json()) as unknown;
        if (!Array.isArray(data)) return null;
        const last = data[6]; // [BID,BID_SIZE,ASK,ASK_SIZE,Δ,Δ%,LAST_PRICE,VOLUME,HIGH,LOW]
        return typeof last === 'number' ? last : null;
      } catch {
        return null;
      }
    },
  };
}

/**
 * Composes pricing sources into one that tries each **in order** (primary first)
 * and returns the first **non-null** price; an adapter that throws or returns
 * `null` is skipped. Returns `null` only when every source declines. This is the
 * "Tether-aligned primary (Bitfinex) → optional fallback (CoinGecko)" strategy.
 */
export function createFallbackPricingAdapter(adapters: readonly PricingAdapter[]): PricingAdapter {
  if (adapters.length === 0) {
    throw new Error('createFallbackPricingAdapter: at least one adapter is required');
  }
  return {
    async getUsdPrice(symbol) {
      for (const adapter of adapters) {
        try {
          const price = await adapter.getUsdPrice(symbol);
          if (price !== null) return price;
        } catch {
          // source unavailable — try the next
        }
      }
      return null;
    },
  };
}
