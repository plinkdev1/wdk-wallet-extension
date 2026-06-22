import { describe, it, expect, vi } from 'vitest';
import { createMockIndexerAdapter, createEtherscanIndexerAdapter, createSolanaRpcIndexerAdapter, type TransactionRecord } from './indexer.js';

const SAMPLE_TX: TransactionRecord = {
  hash: '0xabc',
  blockNumber: 18000000n,
  timestamp: 1700000000,
  from: '0xfrom',
  to: '0xto',
  value: 1000000000000000000n,
  status: 'success',
};

describe('indexer adapter', () => {
  describe('createMockIndexerAdapter', () => {
    it('returns empty array by default', async () => {
      const adapter = createMockIndexerAdapter();
      const txs = await adapter.getTransactions('ethereum', '0xabc');
      expect(txs).toEqual([]);
    });

    it('returns the configured fixedTransactions array', async () => {
      const adapter = createMockIndexerAdapter({ fixedTransactions: [SAMPLE_TX] });
      const txs = await adapter.getTransactions('ethereum', '0xabc');
      expect(txs).toEqual([SAMPLE_TX]);
    });

    it('routes to onGetTransactions handler (passes through chain + address + options)', async () => {
      const handler = vi.fn(async () => [SAMPLE_TX]);
      const adapter = createMockIndexerAdapter({ onGetTransactions: handler });

      const txs = await adapter.getTransactions('plasma-mainnet', '0xfoo', { limit: 10, fromBlock: 100n });

      expect(txs).toEqual([SAMPLE_TX]);
      expect(handler).toHaveBeenCalledWith('plasma-mainnet', '0xfoo', { limit: 10, fromBlock: 100n });
    });

    describe('enforces request filters on the fixed set (B-10)', () => {
      // newest-first, like the real adapters
      const fixed: TransactionRecord[] = [30n, 20n, 10n].map((b) => ({ ...SAMPLE_TX, hash: '0x' + b, blockNumber: b }));
      const adapter = createMockIndexerAdapter({ fixedTransactions: fixed });

      it('truncates to `limit`', async () => {
        const txs = await adapter.getTransactions('ethereum', '0xabc', { limit: 2 });
        expect(txs.map((t) => t.blockNumber)).toEqual([30n, 20n]);
      });

      it('windows by fromBlock/toBlock (inclusive)', async () => {
        const txs = await adapter.getTransactions('ethereum', '0xabc', { fromBlock: 10n, toBlock: 20n });
        expect(txs.map((t) => t.blockNumber)).toEqual([20n, 10n]);
      });

      it('applies window then limit together', async () => {
        const txs = await adapter.getTransactions('ethereum', '0xabc', { fromBlock: 10n, limit: 1 });
        expect(txs.map((t) => t.blockNumber)).toEqual([30n]); // >=10 keeps all, limit takes the newest
      });

      it('returns the full set when no filters are given', async () => {
        const txs = await adapter.getTransactions('ethereum', '0xabc');
        expect(txs).toHaveLength(3);
      });
    });
  });

  describe('createEtherscanIndexerAdapter (B-2)', () => {
    const okBody = (result: unknown) => JSON.stringify({ status: '1', message: 'OK', result });
    const etxlist = [
      { hash: '0x1', blockNumber: '18000000', timeStamp: '1700000000', from: '0xa', to: '0xb', value: '1000000000000000000', isError: '0', txreceipt_status: '1', gasUsed: '21000', gasPrice: '5', nonce: '7' },
      { hash: '0x2', blockNumber: '18000001', timeStamp: '1700000100', from: '0xa', to: '0xc', value: '0', isError: '1', txreceipt_status: '0' },
    ];

    function adapterWith(fetchImpl: typeof fetch) {
      return createEtherscanIndexerAdapter({ apiKey: 'KEY', resolveChainId: () => 1, fetchImpl });
    }

    it('maps the Etherscan txlist into TransactionRecords (incl. extra + status)', async () => {
      const fetchImpl = vi.fn(async () => new Response(okBody(etxlist), { status: 200 })) as unknown as typeof fetch;
      const txs = await adapterWith(fetchImpl).getTransactions('ethereum', '0xa', { limit: 25 });

      expect(txs).toHaveLength(2);
      expect(txs[0]).toMatchObject({ hash: '0x1', blockNumber: 18000000n, timestamp: 1700000000, value: 1000000000000000000n, status: 'success' });
      expect(txs[0]!.extra).toMatchObject({ gasUsed: '21000', nonce: '7' });
      expect(txs[1]!.status).toBe('failed'); // isError '1' / txreceipt_status '0'
    });

    it('builds the v2 request (chainid, action, address, apikey, paging)', async () => {
      const fetchImpl = vi.fn(async (url: string) => {
        const u = new URL(url);
        expect(u.searchParams.get('chainid')).toBe('1');
        expect(u.searchParams.get('action')).toBe('txlist');
        expect(u.searchParams.get('address')).toBe('0xa');
        expect(u.searchParams.get('apikey')).toBe('KEY');
        expect(u.searchParams.get('offset')).toBe('25');
        return new Response(okBody([]), { status: 200 });
      }) as unknown as typeof fetch;
      await adapterWith(fetchImpl).getTransactions('ethereum', '0xa', { limit: 25 });
      expect(fetchImpl).toHaveBeenCalledOnce();
    });

    it('treats "No transactions found" as empty, and surfaces real errors', async () => {
      const empty = vi.fn(async () => new Response(JSON.stringify({ status: '0', message: 'No transactions found', result: [] }), { status: 200 })) as unknown as typeof fetch;
      expect(await adapterWith(empty).getTransactions('ethereum', '0xa')).toEqual([]);

      const err = vi.fn(async () => new Response(JSON.stringify({ status: '0', message: 'NOTOK', result: 'Invalid API Key' }), { status: 200 })) as unknown as typeof fetch;
      await expect(adapterWith(err).getTransactions('ethereum', '0xa')).rejects.toThrow(/Invalid API Key/);
    });

    it('paginates: a full page yields a nextCursor; the cursor advances the page (B-9)', async () => {
      const spy = vi.fn(async (url: string) => {
        const page = new URL(url).searchParams.get('page');
        // page 1 → a full page (2 of limit 2, "more"); page 2 → a partial page (end)
        return new Response(okBody(page === '2' ? [etxlist[0]] : etxlist), { status: 200 });
      });
      const adapter = createEtherscanIndexerAdapter({ apiKey: 'KEY', resolveChainId: () => 1, fetchImpl: spy as unknown as typeof fetch });

      const p1 = await adapter.getTransactionsPage!('ethereum', '0xa', { limit: 2 });
      expect(p1.records).toHaveLength(2);
      expect(p1.nextCursor).toBe('2');

      const p2 = await adapter.getTransactionsPage!('ethereum', '0xa', { limit: 2, cursor: p1.nextCursor! });
      expect(p2.records).toHaveLength(1);
      expect(p2.nextCursor).toBeUndefined(); // partial page → end
      expect(new URL(spy.mock.calls.at(-1)![0]).searchParams.get('page')).toBe('2');
    });
  });

  describe('createSolanaRpcIndexerAdapter (Solana, standard JSON-RPC — no Helius)', () => {
    const ADDR = 'Owner1111111111111111111111111111111111111';
    const CP = 'Peer22222222222222222222222222222222222222';

    // sigAAA: success; sigBBB: failed (err set).
    const SIGS = [
      { signature: 'sigAAA', slot: 250000001, blockTime: 1700000000, err: null },
      { signature: 'sigBBB', slot: 250000000, blockTime: 1699999000, err: { InstructionError: [0, 'Custom'] } },
    ];
    // sigAAA: owner sends 200 lamports to peer (owner delta −200, peer +200).
    const TX_AAA = {
      transaction: { message: { accountKeys: [ADDR, CP] } },
      meta: { preBalances: [1000, 500], postBalances: [800, 700] },
    };

    /** A mock fetch that dispatches by JSON-RPC method in the POST body. */
    function rpcMock(sigs: typeof SIGS = SIGS) {
      return vi.fn(async (_url: string, init?: { body?: string }) => {
        const req = JSON.parse(init?.body ?? '{}') as { method: string; params: unknown[] };
        if (req.method === 'getSignaturesForAddress') {
          return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: sigs }), { status: 200 });
        }
        if (req.method === 'getTransaction') {
          const sig = req.params[0] as string;
          return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: sig === 'sigAAA' ? TX_AAA : null }), { status: 200 });
        }
        return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, error: { message: 'unexpected ' + req.method } }), { status: 200 });
      });
    }
    const bodyOf = (call: unknown[]) => JSON.parse((call[1] as { body: string }).body) as { method: string; params: unknown[] };

    it('maps signatures → records, derives transfer from pre/post balances, reads status from err', async () => {
      const adapter = createSolanaRpcIndexerAdapter({ rpcUrl: 'https://sol.example/rpc', fetchImpl: rpcMock() as unknown as typeof fetch });
      const txs = await adapter.getTransactions('solana-mainnet', ADDR);

      expect(txs).toHaveLength(2);
      expect(txs[0]).toMatchObject({ hash: 'sigAAA', blockNumber: 250000001n, timestamp: 1700000000, from: ADDR, to: CP, value: 200n, status: 'success' });
      expect(txs[0]!.extra).toMatchObject({ slot: 250000001 });
      // err set → failed; getTransaction returns null → no transfer derived.
      expect(txs[1]).toMatchObject({ hash: 'sigBBB', status: 'failed', from: '', to: '', value: 0n });
    });

    it('requests getSignaturesForAddress(address, { limit }) then one getTransaction per signature', async () => {
      const spy = rpcMock();
      const adapter = createSolanaRpcIndexerAdapter({ rpcUrl: 'https://sol.example/rpc', fetchImpl: spy as unknown as typeof fetch });
      await adapter.getTransactions('solana-mainnet', ADDR, { limit: 5 });

      const sigReq = bodyOf(spy.mock.calls.find((c) => bodyOf(c).method === 'getSignaturesForAddress')!);
      expect(sigReq.params[0]).toBe(ADDR);
      expect(sigReq.params[1]).toMatchObject({ limit: 5 });
      expect(spy.mock.calls.filter((c) => bodyOf(c).method === 'getTransaction')).toHaveLength(2);
    });

    it('respects maxEnrich: signatures beyond the cap appear without amounts', async () => {
      const spy = rpcMock();
      const adapter = createSolanaRpcIndexerAdapter({ rpcUrl: 'https://sol.example/rpc', fetchImpl: spy as unknown as typeof fetch, maxEnrich: 1 });
      const txs = await adapter.getTransactions('solana-mainnet', ADDR);

      expect(txs[0]!.value).toBe(200n);                               // enriched
      expect(txs[1]).toMatchObject({ from: '', to: '', value: 0n });  // beyond cap
      expect(spy.mock.calls.filter((c) => bodyOf(c).method === 'getTransaction')).toHaveLength(1);
    });

    it('paginates: a full page yields nextCursor = last signature, passed as `before`', async () => {
      const spy = rpcMock();
      const adapter = createSolanaRpcIndexerAdapter({ rpcUrl: 'https://sol.example/rpc', fetchImpl: spy as unknown as typeof fetch });

      const p1 = await adapter.getTransactionsPage!('solana-mainnet', ADDR, { limit: 2 });
      expect(p1.records).toHaveLength(2);
      expect(p1.nextCursor).toBe('sigBBB'); // last signature, for the `before` cursor

      await adapter.getTransactionsPage!('solana-mainnet', ADDR, { limit: 2, cursor: 'sigBBB' });
      const lastSig = spy.mock.calls.filter((c) => bodyOf(c).method === 'getSignaturesForAddress').at(-1)!;
      expect((bodyOf(lastSig).params[1] as Record<string, unknown>)).toMatchObject({ before: 'sigBBB' });
    });

    it('surfaces RPC errors', async () => {
      const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: { message: 'rate limited' } }), { status: 200 })) as unknown as typeof fetch;
      const adapter = createSolanaRpcIndexerAdapter({ rpcUrl: 'https://sol.example/rpc', fetchImpl });
      await expect(adapter.getTransactions('solana-mainnet', ADDR)).rejects.toThrow(/rate limited/);
    });
  });
});