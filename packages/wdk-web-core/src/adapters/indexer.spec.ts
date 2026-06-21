import { describe, it, expect, vi } from 'vitest';
import { createMockIndexerAdapter, createEtherscanIndexerAdapter, type TransactionRecord } from './indexer.js';

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
  });
});