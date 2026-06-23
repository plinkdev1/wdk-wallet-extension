import { describe, it, expect, vi } from 'vitest';
import {
  createMockPricingAdapter,
  createBitfinexPricingAdapter,
  createCoingeckoPricingAdapter,
  createFallbackPricingAdapter,
  type PricingAdapter,
} from './pricing.js';

describe('pricing adapter', () => {
  describe('createMockPricingAdapter', () => {
    it('returns the configured price (case-insensitive) or null', async () => {
      const a = createMockPricingAdapter({ BTC: 65000, eth: 3200 });
      expect(await a.getUsdPrice('btc')).toBe(65000);
      expect(await a.getUsdPrice('ETH')).toBe(3200);
      expect(await a.getUsdPrice('DOGE')).toBeNull();
    });
  });

  describe('createBitfinexPricingAdapter (Tether-aligned primary)', () => {
    // Bitfinex trading-pair ticker: LAST_PRICE is index 6.
    const ticker = (last: number) => [1, 1, 1, 1, 0, 0, last, 1, 1, 1];

    it('maps a symbol to its pair and reads LAST_PRICE (index 6)', async () => {
      const fetchImpl = vi.fn(async (url: string) => {
        expect(url).toBe('https://api-pub.bitfinex.com/v2/ticker/tBTCUSD');
        return new Response(JSON.stringify(ticker(65123.5)), { status: 200 });
      }) as unknown as typeof fetch;
      expect(await createBitfinexPricingAdapter({ fetchImpl }).getUsdPrice('BTC')).toBe(65123.5);
    });

    it('returns null for an unmapped symbol without fetching', async () => {
      const fetchImpl = vi.fn() as unknown as typeof fetch;
      expect(await createBitfinexPricingAdapter({ fetchImpl }).getUsdPrice('NOPE')).toBeNull();
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('returns null on a non-OK response or unexpected shape', async () => {
      const bad = vi.fn(async () => new Response('x', { status: 502 })) as unknown as typeof fetch;
      expect(await createBitfinexPricingAdapter({ fetchImpl: bad }).getUsdPrice('ETH')).toBeNull();
      const weird = vi.fn(async () => new Response(JSON.stringify({ not: 'array' }), { status: 200 })) as unknown as typeof fetch;
      expect(await createBitfinexPricingAdapter({ fetchImpl: weird }).getUsdPrice('ETH')).toBeNull();
    });

    it('honors a custom symbolMap', async () => {
      const fetchImpl = vi.fn(async (url: string) => {
        expect(url).toContain('/ticker/tFOO:USD');
        return new Response(JSON.stringify(ticker(1.23)), { status: 200 });
      }) as unknown as typeof fetch;
      expect(await createBitfinexPricingAdapter({ fetchImpl, symbolMap: { FOO: 'FOO:USD' } }).getUsdPrice('foo')).toBe(1.23);
    });
  });

  describe('createCoingeckoPricingAdapter', () => {
    it('constructs and conforms to the PricingAdapter interface', () => {
      const a = createCoingeckoPricingAdapter({ coinIds: { BTC: 'bitcoin' } });
      expect(typeof a.getUsdPrice).toBe('function');
    });
  });

  describe('createFallbackPricingAdapter', () => {
    const fixed = (n: number | null): PricingAdapter => ({ getUsdPrice: async () => n });
    const boom = (): PricingAdapter => ({ getUsdPrice: async () => { throw new Error('source down'); } });

    it('returns the first non-null price and short-circuits', async () => {
      const second = vi.fn(async () => 2);
      const a = createFallbackPricingAdapter([fixed(1), { getUsdPrice: second }]);
      expect(await a.getUsdPrice('BTC')).toBe(1);
      expect(second).not.toHaveBeenCalled();
    });

    it('falls through on null', async () => {
      const a = createFallbackPricingAdapter([fixed(null), fixed(42)]);
      expect(await a.getUsdPrice('BTC')).toBe(42);
    });

    it('falls through on a thrown error', async () => {
      const a = createFallbackPricingAdapter([boom(), fixed(7)]);
      expect(await a.getUsdPrice('BTC')).toBe(7);
    });

    it('returns null when every source declines', async () => {
      expect(await createFallbackPricingAdapter([fixed(null), boom()]).getUsdPrice('BTC')).toBeNull();
    });

    it('throws when constructed with no adapters', () => {
      expect(() => createFallbackPricingAdapter([])).toThrow(/at least one adapter/);
    });
  });
});
