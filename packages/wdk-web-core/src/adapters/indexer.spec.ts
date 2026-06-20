import { describe, it, expect, vi } from 'vitest';
import { createMockIndexerAdapter, type TransactionRecord } from './indexer.js';

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
});