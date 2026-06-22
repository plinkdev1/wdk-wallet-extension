import { describe, it, expect, vi } from 'vitest';
import {
  createWebSocketSubscriptionAdapter,
  createMockSubscriptionAdapter,
  ERC20_TRANSFER_TOPIC,
  type WebSocketLike,
  type ChainTick,
} from './subscription.js';

/** Drain queued microtasks (the fake socket opens + acks via queueMicrotask). */
const flush = () => new Promise((r) => setTimeout(r, 0));

/**
 * A fake WebSocket: auto-opens, auto-acks subscribe/unsubscribe requests with
 * sequential server ids (hex for `eth_*`, numeric otherwise), and lets a test
 * push notifications or drop the connection.
 */
class FakeWebSocket implements WebSocketLike {
  onopen: ((ev?: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: ((ev?: unknown) => void) | null = null;
  onerror: ((ev?: unknown) => void) | null = null;
  readonly sent: Array<{ id: number; method: string; params: unknown[] }> = [];
  closed = false;
  private autoId = 0;
  static instances: FakeWebSocket[] = [];

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
    queueMicrotask(() => this.onopen?.());
  }

  send(data: string): void {
    const msg = JSON.parse(data) as { id: number; method: string; params: unknown[] };
    this.sent.push(msg);
    const isUnsub = /unsubscribe$/i.test(msg.method);
    const isSub = !isUnsub && /subscribe$/i.test(msg.method);
    if (isSub) {
      const sid: string | number = msg.method.startsWith('eth_') ? '0x' + (++this.autoId).toString(16) : ++this.autoId;
      queueMicrotask(() => this.onmessage?.({ data: JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: sid }) }));
    } else if (isUnsub) {
      queueMicrotask(() => this.onmessage?.({ data: JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: true }) }));
    }
  }

  close(): void {
    this.closed = true;
    queueMicrotask(() => this.onclose?.());
  }

  /** Push a subscription notification for a given server id. */
  notify(serverId: string | number, result: unknown): void {
    this.onmessage?.({ data: JSON.stringify({ jsonrpc: '2.0', method: 'eth_subscription', params: { subscription: serverId, result } }) });
  }

  /** Simulate an unexpected drop. */
  drop(): void {
    this.onclose?.();
  }

  subscribeCalls(): Array<{ id: number; method: string; params: unknown[] }> {
    return this.sent.filter((m) => /subscribe$/i.test(m.method) && !/unsubscribe$/i.test(m.method));
  }
}

function harness(extra: Partial<Parameters<typeof createWebSocketSubscriptionAdapter>[0]> = {}) {
  FakeWebSocket.instances = [];
  const adapter = createWebSocketSubscriptionAdapter({
    resolveWsUrl: (chain) => `wss://${chain}.example/rpc`,
    webSocketImpl: FakeWebSocket as unknown as new (url: string) => WebSocketLike,
    ...extra,
  });
  return { adapter, sockets: FakeWebSocket };
}

describe('subscription adapter', () => {
  describe('createWebSocketSubscriptionAdapter (B-8) — EVM', () => {
    it('subscribes to newHeads and pushes block ticks (hex number → bigint)', async () => {
      const { adapter, sockets } = harness();
      const ticks: ChainTick[] = [];
      const sub = await adapter.subscribeBlocks('ethereum', (t) => ticks.push(t));

      const ws = sockets.instances[0]!;
      expect(ws.subscribeCalls()[0]).toMatchObject({ method: 'eth_subscribe', params: ['newHeads'] });

      ws.notify('0x1', { number: '0x10' });
      expect(ticks).toHaveLength(1);
      expect(ticks[0]).toMatchObject({ chain: 'ethereum', kind: 'block', blockNumber: 16n });

      await sub.unsubscribe();
      // last frame is eth_unsubscribe with the server id, then the socket closes (no more subs).
      expect(ws.sent.at(-1)).toMatchObject({ method: 'eth_unsubscribe', params: ['0x1'] });
      expect(ws.closed).toBe(true);
    });

    it('address activity uses TWO Transfer-log filters (incoming + outgoing) and maps the tx hash', async () => {
      const { adapter, sockets } = harness();
      const ADDR = '0x' + 'ab'.repeat(20);
      const padded = '0x' + '0'.repeat(24) + 'ab'.repeat(20);
      const ticks: ChainTick[] = [];
      const sub = await adapter.subscribeAddress('ethereum', ADDR, (t) => ticks.push(t));

      const ws = sockets.instances[0]!;
      const subs = ws.subscribeCalls();
      expect(subs).toHaveLength(2);
      // recipient filter: [topic, null, padded]; sender filter: [topic, padded, null]
      expect(subs[0]!.params).toEqual(['logs', { topics: [ERC20_TRANSFER_TOPIC, null, padded] }]);
      expect(subs[1]!.params).toEqual(['logs', { topics: [ERC20_TRANSFER_TOPIC, padded, null] }]);

      ws.notify('0x1', { transactionHash: '0xdeadbeef', blockNumber: '0x20' });
      expect(ticks).toHaveLength(1);
      expect(ticks[0]).toMatchObject({ chain: 'ethereum', kind: 'activity', hash: '0xdeadbeef', blockNumber: 32n });

      await sub.unsubscribe();
      // both server subscriptions are torn down.
      const unsubs = ws.sent.filter((m) => m.method === 'eth_unsubscribe');
      expect(unsubs.map((u) => u.params[0])).toEqual(['0x1', '0x2']);
      expect(ws.closed).toBe(true);
    });

    it('shares one socket across subscriptions on the same chain; closes only when the last is gone', async () => {
      const { adapter, sockets } = harness();
      const a = await adapter.subscribeBlocks('ethereum', () => {});
      const b = await adapter.subscribeBlocks('ethereum', () => {});
      expect(sockets.instances).toHaveLength(1); // one shared socket

      await a.unsubscribe();
      expect(sockets.instances[0]!.closed).toBe(false); // b still active
      await b.unsubscribe();
      expect(sockets.instances[0]!.closed).toBe(true); // now empty → closed
    });

    it('reconnects after an unexpected drop and re-establishes the subscription', async () => {
      const { adapter, sockets } = harness({ setTimeoutImpl: (fn) => { fn(); }, reconnectBaseMs: 1 });
      const ticks: ChainTick[] = [];
      await adapter.subscribeBlocks('ethereum', (t) => ticks.push(t));
      expect(sockets.instances).toHaveLength(1);

      sockets.instances[0]!.drop();   // simulate a dropped connection
      await flush();                  // reconnect + re-subscribe on a fresh socket

      expect(sockets.instances).toHaveLength(2);
      expect(sockets.instances[1]!.subscribeCalls()[0]).toMatchObject({ method: 'eth_subscribe', params: ['newHeads'] });
      sockets.instances[1]!.notify('0x1', { number: '0x2a' }); // re-issued id on the new socket
      expect(ticks).toHaveLength(1);
      expect(ticks[0]!.blockNumber).toBe(42n);
    });
  });

  describe('createWebSocketSubscriptionAdapter (B-8) — Solana', () => {
    it('uses slotSubscribe (numeric id) and maps slot → blockNumber; unsubscribe passes a numeric id', async () => {
      const { adapter, sockets } = harness();
      const ticks: ChainTick[] = [];
      const sub = await adapter.subscribeBlocks('solana-mainnet', (t) => ticks.push(t));

      const ws = sockets.instances[0]!;
      expect(ws.subscribeCalls()[0]).toMatchObject({ method: 'slotSubscribe', params: [] });

      ws.notify(1, { slot: 250000000 });
      expect(ticks[0]).toMatchObject({ chain: 'solana-mainnet', kind: 'block', blockNumber: 250000000n });

      await sub.unsubscribe();
      expect(ws.sent.at(-1)).toMatchObject({ method: 'slotUnsubscribe', params: [1] }); // numeric id, not "1"
    });

    it('address activity uses logsSubscribe { mentions } and maps the signature', async () => {
      const { adapter, sockets } = harness();
      const ticks: ChainTick[] = [];
      await adapter.subscribeAddress('solana-mainnet', 'Owner111', (t) => ticks.push(t));

      const ws = sockets.instances[0]!;
      expect(ws.subscribeCalls()[0]).toMatchObject({ method: 'logsSubscribe', params: [{ mentions: ['Owner111'] }, { commitment: 'confirmed' }] });

      ws.notify(1, { value: { signature: 'sigXYZ', err: null } });
      expect(ticks[0]).toMatchObject({ chain: 'solana-mainnet', kind: 'activity', hash: 'sigXYZ' });
    });
  });

  describe('family validation', () => {
    it('rejects non-EVM/Solana chains', async () => {
      const { adapter } = harness();
      await expect(adapter.subscribeBlocks('bitcoin-mainnet', () => {})).rejects.toThrow(/EVM \+ Solana/);
    });

    it('throws when no WebSocket implementation is available', async () => {
      // Node's vitest env has a global WebSocket; remove it so the fallback is empty.
      const g = globalThis as { WebSocket?: unknown };
      const saved = g.WebSocket;
      g.WebSocket = undefined;
      try {
        const adapter = createWebSocketSubscriptionAdapter({ resolveWsUrl: () => 'wss://x' });
        await expect(adapter.subscribeBlocks('ethereum', () => {})).rejects.toThrow(/no WebSocket available/);
      } finally {
        g.WebSocket = saved;
      }
    });
  });

  describe('createMockSubscriptionAdapter', () => {
    it('emits block ticks to matching chain subscribers and supports unsubscribe', async () => {
      const mock = createMockSubscriptionAdapter();
      const eth: ChainTick[] = [];
      const sol: ChainTick[] = [];
      const subEth = await mock.subscribeBlocks('ethereum', (t) => eth.push(t));
      await mock.subscribeBlocks('solana-mainnet', (t) => sol.push(t));
      expect(mock.activeCount()).toBe(2);

      mock.emitBlock('ethereum', 100n);
      expect(eth).toHaveLength(1);
      expect(eth[0]).toMatchObject({ kind: 'block', blockNumber: 100n });
      expect(sol).toHaveLength(0); // chain-scoped

      await subEth.unsubscribe();
      mock.emitBlock('ethereum', 101n);
      expect(eth).toHaveLength(1); // no longer subscribed
      expect(mock.activeCount()).toBe(1);
    });

    it('emits activity ticks only to the matching chain + address', async () => {
      const mock = createMockSubscriptionAdapter();
      const hits: ChainTick[] = [];
      await mock.subscribeAddress('ethereum', '0xabc', (t) => hits.push(t));

      mock.emitActivity('ethereum', '0xother', 'h1'); // wrong address
      mock.emitActivity('ethereum', '0xabc', 'h2');    // match
      expect(hits).toHaveLength(1);
      expect(hits[0]).toMatchObject({ kind: 'activity', hash: 'h2' });
    });
  });
});
