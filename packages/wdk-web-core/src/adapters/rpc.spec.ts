import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHttpRpcAdapter, createMockRpcAdapter } from './rpc.js';

describe('rpc adapter', () => {
  describe('createMockRpcAdapter', () => {
    it('returns 0n for unmapped balances by default', async () => {
      const adapter = createMockRpcAdapter();
      expect(await adapter.getBalance('ethereum', '0xabc')).toBe(0n);
      expect(await adapter.getTokenBalance('ethereum', '0xabc', '0xtoken')).toBe(0n);
    });

    it('returns mapped balance from balances Map (key: chainId:address)', async () => {
      const adapter = createMockRpcAdapter({
        balances: new Map([['ethereum:0xabc', 12345n]]),
      });
      expect(await adapter.getBalance('ethereum', '0xabc')).toBe(12345n);
      expect(await adapter.getBalance('ethereum', '0xdef')).toBe(0n);
    });

    it('routes to onGetBalance handler when provided (overrides balances Map)', async () => {
      const handler = vi.fn(async () => 99n);
      const adapter = createMockRpcAdapter({
        balances: new Map([['ethereum:0xabc', 12345n]]),
        onGetBalance: handler,
      });
      expect(await adapter.getBalance('ethereum', '0xabc')).toBe(99n);
      expect(handler).toHaveBeenCalledWith('ethereum', '0xabc');
    });

    it("defaults getTransactionStatus to 'pending' and reads the statuses Map", async () => {
      const adapter = createMockRpcAdapter({
        transactionStatuses: new Map([['ethereum:0xhash', 'success']]),
      });
      expect(await adapter.getTransactionStatus('ethereum', '0xunknown')).toBe('pending');
      expect(await adapter.getTransactionStatus('ethereum', '0xhash')).toBe('success');
    });

    it('routes to onGetTransactionStatus handler when provided', async () => {
      const handler = vi.fn(async () => 'failed' as const);
      const adapter = createMockRpcAdapter({ onGetTransactionStatus: handler });
      expect(await adapter.getTransactionStatus('ethereum', '0xhash')).toBe('failed');
      expect(handler).toHaveBeenCalledWith('ethereum', '0xhash');
    });

    it('getTokenBalances batches in order (B-5)', async () => {
      const adapter = createMockRpcAdapter({
        tokenBalances: new Map([
          ['ethereum:0xabc:0xUSDt', 1000000n],
          ['ethereum:0xabc:0xXAUt', 5n],
        ]),
      });
      expect(await adapter.getTokenBalances!('ethereum', '0xabc', ['0xUSDt', '0xXAUt', '0xunknown']))
        .toEqual([1000000n, 5n, 0n]);
    });
  });

  describe('createHttpRpcAdapter', () => {
    let originalFetch: typeof fetch | undefined;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      if (originalFetch !== undefined) {
        globalThis.fetch = originalFetch;
      }
    });

    it('getBalance for EVM chains routes through viem (JSON-RPC eth_getBalance)', async () => {
      const mockFetch = vi.fn(async (_url: unknown, init: unknown) => {
        const body = JSON.parse((init as { body: string }).body);
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id: body.id,
          result: '0x1234567890abcdef',
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      });
      vi.stubGlobal('fetch', mockFetch);

      const adapter = createHttpRpcAdapter();
      const balance = await adapter.getBalance('ethereum', '0x0000000000000000000000000000000000000001');

      expect(balance).toBe(BigInt('0x1234567890abcdef'));
      expect(mockFetch).toHaveBeenCalled();
    });

    it('getBalance for Solana chains routes through direct JSON-RPC getBalance', async () => {
      const mockFetch = vi.fn(async () => new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { context: { slot: 100 }, value: 1000000 },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      vi.stubGlobal('fetch', mockFetch);

      const adapter = createHttpRpcAdapter();
      const balance = await adapter.getBalance('solana-mainnet', 'SomeBase58PublicKey');

      expect(balance).toBe(1000000n);
      expect(mockFetch).toHaveBeenCalled();
      const call = mockFetch.mock.calls[0]! as unknown as [string, RequestInit];
      const body = JSON.parse(call[1].body as string);
      expect(body.method).toBe('getBalance');
      expect(body.params).toEqual(['SomeBase58PublicKey']);
    });

    it('preserves Solana lamports above 2^53 (F-RPC-01)', async () => {
      // Raw body: the huge u64 must never be coerced to a JS Number before we parse it.
      const huge = '18446744073709551615'; // 2^64 - 1
      const mockFetch = vi.fn(async () => new Response(
        `{"jsonrpc":"2.0","id":1,"result":{"context":{"slot":100},"value":${huge}}}`,
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ));
      vi.stubGlobal('fetch', mockFetch);

      const adapter = createHttpRpcAdapter();
      const balance = await adapter.getBalance('solana-mainnet', 'SomeBase58PublicKey');

      expect(balance).toBe(BigInt(huge));
      // sanity: this value is NOT representable precisely as a JS number
      expect(BigInt(Number(huge))).not.toBe(BigInt(huge));
    });

    it('throws for unsupported chain (no loader registered)', async () => {
      const adapter = createHttpRpcAdapter();
      await expect(
        adapter.getBalance('not-a-chain' as never, '0x0'),
      ).rejects.toThrowError(/Unsupported chain/);
    });

    it('getTokenBalance sums Solana SPL token accounts for the mint (B-1)', async () => {
      const mockFetch = vi.fn(async () => new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: {
          value: [
            { account: { data: { parsed: { info: { tokenAmount: { amount: '1500000' } } } } } },
            { account: { data: { parsed: { info: { tokenAmount: { amount: '2500000' } } } } } },
          ],
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      vi.stubGlobal('fetch', mockFetch);

      const adapter = createHttpRpcAdapter();
      const balance = await adapter.getTokenBalance('solana-mainnet', 'OwnerPubkey', 'MintPubkey');

      expect(balance).toBe(4000000n); // 1.5 + 2.5
      const call = mockFetch.mock.calls[0]! as unknown as [string, RequestInit];
      const body = JSON.parse(call[1].body as string);
      expect(body.method).toBe('getTokenAccountsByOwner');
      expect(body.params[0]).toBe('OwnerPubkey');
      expect(body.params[1]).toEqual({ mint: 'MintPubkey' });
    });

    it('getTokenBalance returns 0 when the owner holds no account for the mint', async () => {
      const mockFetch = vi.fn(async () => new Response(
        JSON.stringify({ jsonrpc: '2.0', id: 1, result: { value: [] } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ));
      vi.stubGlobal('fetch', mockFetch);
      const adapter = createHttpRpcAdapter();
      expect(await adapter.getTokenBalance('solana-mainnet', 'OwnerPubkey', 'MintPubkey')).toBe(0n);
    });

    it('getTokenBalances issues concurrent reads (B-5)', async () => {
      const mockFetch = vi.fn(async () => new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { value: [{ account: { data: { parsed: { info: { tokenAmount: { amount: '1000000' } } } } } }] },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      vi.stubGlobal('fetch', mockFetch);

      const adapter = createHttpRpcAdapter();
      const balances = await adapter.getTokenBalances!('solana-mainnet', 'OwnerPubkey', ['MintA', 'MintB']);

      expect(balances).toEqual([1000000n, 1000000n]);
      expect(mockFetch).toHaveBeenCalledTimes(2); // one RPC per mint, dispatched together
    });

    it('applies an opt-in rate limit across calls (B-7)', async () => {
      const mockFetch = vi.fn(async () => new Response(
        JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0x1' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ));
      vi.stubGlobal('fetch', mockFetch);

      let t = 0;
      const waits: number[] = [];
      const adapter = createHttpRpcAdapter({
        rateLimit: { rps: 1, burst: 1, now: () => t, sleep: async (ms) => { waits.push(ms); t += ms; } },
      });
      const addr = '0x0000000000000000000000000000000000000001';
      await adapter.getBalance('ethereum', addr); // consumes the 1 token
      await adapter.getBalance('ethereum', addr); // must wait for a refill

      expect(waits).toEqual([1000]); // 1 token @ 1 rps = 1000ms
    });
  });
});