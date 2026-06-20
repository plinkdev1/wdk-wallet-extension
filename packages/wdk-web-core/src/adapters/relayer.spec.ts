import { describe, it, expect, vi } from 'vitest';
import {
  createHttpRelayerAdapter,
  createMockRelayerAdapter,
} from './relayer.js';

const TINY_CALLDATA = '0xdeadbeef' as const;
const OVERSIZED_CALLDATA = ('0x' + 'a'.repeat(3001)) as `0x${string}`;
const TO = '0x0000000000000000000000000000000000000001' as const;

describe('relayer adapter', () => {
  describe('createHttpRelayerAdapter', () => {
    it('POSTs JSON to the configured endpoint and returns the txHash', async () => {
      const mockFetch = vi.fn(async () => new Response(JSON.stringify({ txHash: '0xabc123' }), { status: 200 }));
      const adapter = createHttpRelayerAdapter({
        endpoint: 'https://relayer.example.com/submit',
        fetch: mockFetch as unknown as typeof fetch,
      });

      const result = await adapter.submit({ chainId: 9745, to: TO, calldata: TINY_CALLDATA });

      expect(result.txHash).toBe('0xabc123');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const call = mockFetch.mock.calls[0]! as unknown as [string, RequestInit];
      const url = call[0];
      const init = call[1];
      expect(url).toBe('https://relayer.example.com/submit');
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual({ 'Content-Type': 'application/json' });

      const body = JSON.parse(init.body as string);
      expect(body).toEqual({ chainId: 9745, to: TO, calldata: TINY_CALLDATA });
    });

    it('rejects calldata exceeding MAX_TX_DATA before any HTTP call (F-EIP3009-01)', async () => {
      const mockFetch = vi.fn();
      const adapter = createHttpRelayerAdapter({
        endpoint: 'https://relayer.example.com/submit',
        fetch: mockFetch as unknown as typeof fetch,
      });

      await expect(adapter.submit({ chainId: 1, to: TO, calldata: OVERSIZED_CALLDATA })).rejects.toThrowError(/F-EIP3009-01/);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('rethrows HTTP errors with status and body context', async () => {
      const mockFetch = vi.fn(async () => new Response('relayer broken', { status: 503, statusText: 'Service Unavailable' }));
      const adapter = createHttpRelayerAdapter({
        endpoint: 'https://relayer.example.com/submit',
        fetch: mockFetch as unknown as typeof fetch,
      });

      await expect(adapter.submit({ chainId: 1, to: TO, calldata: TINY_CALLDATA })).rejects.toThrowError(/503/);
    });

    it('rejects responses missing txHash', async () => {
      const mockFetch = vi.fn(async () => new Response(JSON.stringify({ error: 'no good' }), { status: 200 }));
      const adapter = createHttpRelayerAdapter({
        endpoint: 'https://relayer.example.com/submit',
        fetch: mockFetch as unknown as typeof fetch,
      });

      await expect(adapter.submit({ chainId: 1, to: TO, calldata: TINY_CALLDATA })).rejects.toThrowError(/missing txHash/);
    });
  });

  describe('createMockRelayerAdapter', () => {
    it('returns the configured fixedTxHash', async () => {
      const adapter = createMockRelayerAdapter({ fixedTxHash: '0xfeed' });
      const result = await adapter.submit({ chainId: 1, to: TO, calldata: TINY_CALLDATA });
      expect(result.txHash).toBe('0xfeed');
    });

    it('routes to onSubmit handler when provided (for test fixtures)', async () => {
      const handler = vi.fn(async (params: { chainId: number }) => ({
        txHash: ('0x' + params.chainId.toString(16).padStart(64, '0')) as `0x${string}`,
      }));
      const adapter = createMockRelayerAdapter({ onSubmit: handler });

      const result = await adapter.submit({ chainId: 9745, to: TO, calldata: TINY_CALLDATA });

      expect(handler).toHaveBeenCalledOnce();
      // 9745 in hex is 0x2611, padded to 64 chars
      expect(result.txHash).toBe('0x' + '0'.repeat(60) + '2611');
    });

    it('also enforces MAX_TX_DATA (size check applies to both impls)', async () => {
      const adapter = createMockRelayerAdapter();
      await expect(adapter.submit({ chainId: 1, to: TO, calldata: OVERSIZED_CALLDATA })).rejects.toThrowError(/F-EIP3009-01/);
    });
  });
});