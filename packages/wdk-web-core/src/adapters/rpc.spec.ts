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

    it('throws for unsupported chain (no loader registered)', async () => {
      const adapter = createHttpRpcAdapter();
      await expect(
        adapter.getBalance('not-a-chain' as never, '0x0'),
      ).rejects.toThrowError(/Unsupported chain/);
    });

    it('getTokenBalance throws for Solana (SPL ATA resolution deferred to v1.1)', async () => {
      const adapter = createHttpRpcAdapter();
      await expect(
        adapter.getTokenBalance('solana-mainnet', 'pubkey', 'mint'),
      ).rejects.toThrowError(/v1\.1/);
    });
  });
});