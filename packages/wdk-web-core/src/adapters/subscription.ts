/**
 * @wdk-starter/wdk-web-core/adapters/subscription
 *
 * Live on-chain push over WebSocket (B-8). A wallet polls balances on a timer
 * by default; this adapter lets a product switch to push — re-reading balances /
 * history only when a new block lands or the watched address is actually touched.
 *
 * Two implementations, mirroring the RPC + indexer adapters:
 *
 *   - createWebSocketSubscriptionAdapter: a real client over standard JSON-RPC
 *     WebSocket subscriptions, so it works against any provider that speaks them
 *     (e.g. an Alchemy `wss://` endpoint — EVM `eth_subscribe` newHeads/logs and
 *     Solana `slotSubscribe`/`logsSubscribe`). It correlates request/response by
 *     JSON-RPC id, routes server notifications to handlers by subscription id,
 *     and transparently reconnects (exponential backoff) — re-establishing every
 *     active subscription on a fresh socket. The `wss://` URL is dev-supplied via
 *     `resolveWsUrl` (template-standard — nothing hard-coded).
 *
 *   - createMockSubscriptionAdapter: in-memory, no network. Lets tests / dev UIs
 *     drive ticks via `emitBlock` / `emitActivity`.
 *
 * Only EVM + Solana are subscribable here; other families throw (no standard WS
 * subscription). See: kickoff Part V (B-8), ADR-010.
 */

import { SOLANA_CHAIN_IDS, EVM_CHAIN_IDS } from '../types/index.js';
import type { ChainId } from '../types/index.js';

/** A live on-chain event pushed over a WebSocket subscription (B-8). */
export interface ChainTick {
  /** Chain the tick came from. */
  readonly chain: ChainId;
  /** 'block' = a new head/slot; 'activity' = the watched address was involved in a tx. */
  readonly kind: 'block' | 'activity';
  /** New block number (EVM) or slot (Solana), when the payload carries it. */
  readonly blockNumber?: bigint;
  /** For 'activity': the tx hash (EVM) / signature (Solana), when known. */
  readonly hash?: string;
  /** Raw provider notification payload (escape hatch for product-specific fields). */
  readonly raw?: unknown;
}

/** An active subscription. `unsubscribe()` is idempotent. */
export interface Subscription {
  unsubscribe(): Promise<void>;
}

export interface SubscriptionAdapter {
  /**
   * New block / slot ticks (EVM `eth_subscribe` newHeads; Solana `slotSubscribe`).
   * Universally supported — the simplest "refetch balances on each block" driver.
   */
  subscribeBlocks(chain: ChainId, onTick: (tick: ChainTick) => void): Promise<Subscription>;
  /**
   * Activity touching `address` — the wallet's cue to refetch balances/history.
   * EVM watches ERC-20 `Transfer` logs with the address as sender OR recipient
   * (two `eth_subscribe` logs filters); Solana uses `logsSubscribe { mentions }`.
   * Best-effort — native-only EVM transfers (no log) are caught by the block tick.
   */
  subscribeAddress(chain: ChainId, address: string, onTick: (tick: ChainTick) => void): Promise<Subscription>;
}

/** Structural subset of the DOM `WebSocket` the adapter uses (so it's injectable in tests). */
export interface WebSocketLike {
  send(data: string): void;
  close(): void;
  onopen: ((ev?: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev?: unknown) => void) | null;
  onerror: ((ev?: unknown) => void) | null;
}
export type WebSocketCtor = new (url: string) => WebSocketLike;

export interface WebSocketSubscriptionOptions {
  /** Resolve a chain to its `wss://` JSON-RPC URL. Dev-supplied (e.g. from env) — never hard-coded. */
  readonly resolveWsUrl: (chain: ChainId) => string | Promise<string>;
  /** Injectable WebSocket constructor (tests / non-browser). Defaults to `globalThis.WebSocket`. */
  readonly webSocketImpl?: WebSocketCtor;
  /** Max reconnect attempts after an unexpected drop (default 5). 0 disables reconnect. */
  readonly maxReconnects?: number;
  /** Base reconnect backoff in ms (default 1000); doubles per attempt, capped at 30s. */
  readonly reconnectBaseMs?: number;
  /** Injectable timer for reconnect scheduling (tests). Defaults to `setTimeout`. */
  readonly setTimeoutImpl?: (fn: () => void, ms: number) => void;
}

/** keccak256("Transfer(address,address,uint256)") — the ERC-20 Transfer log topic0. */
export const ERC20_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const SOLANA_SET = new Set<string>(SOLANA_CHAIN_IDS);
const EVM_SET = new Set<string>(EVM_CHAIN_IDS);

function familyOf(chain: ChainId): 'evm' | 'solana' {
  if (SOLANA_SET.has(chain)) return 'solana';
  if (EVM_SET.has(chain)) return 'evm';
  throw new Error('WebSocket subscriptions support EVM + Solana chains only: ' + chain);
}

/** Left-pad a 20-byte address to a 32-byte log topic (for `eth_subscribe` logs filters). */
function toTopicAddress(address: string): string {
  const hex = address.toLowerCase().replace(/^0x/, '').padStart(40, '0');
  return '0x' + '0'.repeat(24) + hex;
}

function hexToBig(v: unknown): bigint | undefined {
  return typeof v === 'string' && /^0x[0-9a-fA-F]+$/.test(v) ? BigInt(v) : undefined;
}
function numToBig(v: unknown): bigint | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? BigInt(Math.trunc(v)) : undefined;
}

function makeTick(chain: ChainId, kind: 'block' | 'activity', raw: unknown, blockNumber?: bigint, hash?: string): ChainTick {
  return {
    chain, kind, raw,
    ...(blockNumber !== undefined ? { blockNumber } : {}),
    ...(hash !== undefined ? { hash } : {}),
  };
}

/** One desired subscription on a connection (survives reconnects; serverId is re-issued). */
interface Registration {
  readonly subMethod: string;
  readonly subParams: unknown[];
  readonly unsubMethod: string;
  /** Solana subscription ids are numeric; EVM ids are hex strings. */
  readonly numericId: boolean;
  readonly onNotify: (result: unknown) => void;
  serverId: string | null;
}

/** A single WebSocket connection to one `wss://` URL, shared by every sub on that chain. */
interface Connection {
  add(reg: Omit<Registration, 'serverId'>): Promise<Registration>;
  removeAll(regs: readonly Registration[]): Promise<void>;
  isEmpty(): boolean;
}

function createConnection(
  url: string,
  Ctor: WebSocketCtor,
  cfg: { maxReconnects: number; reconnectBaseMs: number; schedule: (fn: () => void, ms: number) => void; onClosed: () => void },
): Connection {
  let socket: WebSocketLike | null = null;
  let ready = false;
  let connecting: Promise<void> | null = null;
  let closedByUser = false;
  let reconnects = 0;
  let nextId = 1;
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>();
  const byServerId = new Map<string, Registration>();
  const regs = new Set<Registration>();

  function handleMessage(raw: unknown): void {
    let msg: { id?: unknown; result?: unknown; error?: { message?: string }; params?: { subscription?: unknown; result?: unknown } };
    try { msg = JSON.parse(String(raw)); } catch { return; }
    // JSON-RPC response (correlate by id).
    if (typeof msg.id === 'number' && pending.has(msg.id)) {
      const p = pending.get(msg.id)!;
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error('WS RPC error: ' + (msg.error.message ?? 'unknown')));
      else p.resolve(msg.result);
      return;
    }
    // Subscription notification (route by server subscription id).
    if (msg.params && msg.params.subscription !== undefined) {
      const reg = byServerId.get(String(msg.params.subscription));
      if (reg) reg.onNotify(msg.params.result);
    }
  }

  function connect(): Promise<void> {
    if (ready) return Promise.resolve();
    if (connecting) return connecting;
    connecting = new Promise<void>((resolve, reject) => {
      const ws = new Ctor(url);
      socket = ws;
      ws.onopen = () => { ready = true; connecting = null; reconnects = 0; resolve(); };
      ws.onmessage = (ev) => handleMessage(ev.data);
      ws.onerror = () => { /* surfaced via onclose */ };
      ws.onclose = () => {
        const wasReady = ready;
        ready = false;
        socket = null;
        byServerId.clear();
        for (const r of regs) r.serverId = null;
        for (const p of pending.values()) p.reject(new Error('WS closed'));
        pending.clear();
        if (!wasReady) { connecting = null; reject(new Error('WS closed before open')); return; }
        if (!closedByUser && regs.size > 0 && reconnects < cfg.maxReconnects) {
          const delay = Math.min(cfg.reconnectBaseMs * 2 ** reconnects, 30000);
          reconnects++;
          cfg.schedule(() => { void reestablish(); }, delay);
        }
      };
    });
    return connecting;
  }

  function rpc(method: string, params: unknown[]): Promise<unknown> {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      if (!socket) { reject(new Error('WS not connected')); return; }
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
    });
  }

  async function establish(reg: Registration): Promise<void> {
    const serverId = await rpc(reg.subMethod, reg.subParams);
    reg.serverId = String(serverId);
    byServerId.set(reg.serverId, reg);
  }

  async function reestablish(): Promise<void> {
    try {
      await connect();
      for (const r of regs) await establish(r);
    } catch {
      /* onclose reschedules while attempts remain */
    }
  }

  function maybeClose(): void {
    if (regs.size === 0 && socket) {
      closedByUser = true;
      socket.close();
      cfg.onClosed();
    }
  }

  return {
    async add(partial) {
      await connect();
      const reg: Registration = { ...partial, serverId: null };
      regs.add(reg);
      await establish(reg);
      return reg;
    },
    async removeAll(toRemove) {
      for (const reg of toRemove) {
        if (!regs.delete(reg)) continue;
        const sid = reg.serverId;
        reg.serverId = null;
        if (sid) {
          byServerId.delete(sid);
          if (ready && socket) {
            try { await rpc(reg.unsubMethod, [reg.numericId ? Number(sid) : sid]); } catch { /* best-effort */ }
          }
        }
      }
      maybeClose();
    },
    isEmpty: () => regs.size === 0,
  };
}

/**
 * A real WebSocket subscription adapter over standard JSON-RPC subscriptions
 * (EVM `eth_subscribe`, Solana `slotSubscribe`/`logsSubscribe`). Works against any
 * provider that speaks them (e.g. Alchemy `wss://`). One socket per chain URL is
 * shared across that chain's subscriptions and reconnects automatically.
 */
export function createWebSocketSubscriptionAdapter(options: WebSocketSubscriptionOptions): SubscriptionAdapter {
  const Ctor = options.webSocketImpl ?? (globalThis as { WebSocket?: WebSocketCtor }).WebSocket;
  const maxReconnects = options.maxReconnects ?? 5;
  const reconnectBaseMs = options.reconnectBaseMs ?? 1000;
  const schedule = options.setTimeoutImpl ?? ((fn: () => void, ms: number) => { setTimeout(fn, ms); });
  const conns = new Map<string, Connection>();

  async function getConn(chain: ChainId): Promise<Connection> {
    if (typeof Ctor !== 'function') throw new Error('Subscription adapter: no WebSocket available; pass options.webSocketImpl');
    const url = await options.resolveWsUrl(chain);
    let conn = conns.get(url);
    if (!conn) {
      conn = createConnection(url, Ctor, { maxReconnects, reconnectBaseMs, schedule, onClosed: () => conns.delete(url) });
      conns.set(url, conn);
    }
    return conn;
  }

  function subscription(conn: Connection, regs: Registration[]): Subscription {
    let done = false;
    return {
      async unsubscribe() {
        if (done) return;
        done = true;
        await conn.removeAll(regs);
      },
    };
  }

  return {
    async subscribeBlocks(chain, onTick) {
      const fam = familyOf(chain);
      const conn = await getConn(chain);
      if (fam === 'evm') {
        const reg = await conn.add({
          subMethod: 'eth_subscribe', subParams: ['newHeads'], unsubMethod: 'eth_unsubscribe', numericId: false,
          onNotify: (r) => onTick(makeTick(chain, 'block', r, hexToBig((r as { number?: unknown } | null)?.number))),
        });
        return subscription(conn, [reg]);
      }
      const reg = await conn.add({
        subMethod: 'slotSubscribe', subParams: [], unsubMethod: 'slotUnsubscribe', numericId: true,
        onNotify: (r) => onTick(makeTick(chain, 'block', r, numToBig((r as { slot?: unknown } | null)?.slot))),
      });
      return subscription(conn, [reg]);
    },

    async subscribeAddress(chain, address, onTick) {
      const fam = familyOf(chain);
      const conn = await getConn(chain);
      if (fam === 'evm') {
        const topic = toTopicAddress(address);
        const onLog = (r: unknown) => {
          const log = r as { transactionHash?: unknown; blockNumber?: unknown } | null;
          onTick(makeTick(
            chain, 'activity', r,
            hexToBig(log?.blockNumber),
            typeof log?.transactionHash === 'string' ? log.transactionHash : undefined,
          ));
        };
        // ERC-20 Transfer where the address is sender (topic1) OR recipient (topic2) — two filters.
        const incoming = await conn.add({
          subMethod: 'eth_subscribe', subParams: ['logs', { topics: [ERC20_TRANSFER_TOPIC, null, topic] }],
          unsubMethod: 'eth_unsubscribe', numericId: false, onNotify: onLog,
        });
        const outgoing = await conn.add({
          subMethod: 'eth_subscribe', subParams: ['logs', { topics: [ERC20_TRANSFER_TOPIC, topic, null] }],
          unsubMethod: 'eth_unsubscribe', numericId: false, onNotify: onLog,
        });
        return subscription(conn, [incoming, outgoing]);
      }
      const reg = await conn.add({
        subMethod: 'logsSubscribe', subParams: [{ mentions: [address] }, { commitment: 'confirmed' }],
        unsubMethod: 'logsUnsubscribe', numericId: true,
        onNotify: (r) => {
          const v = (r as { value?: { signature?: unknown } } | null)?.value;
          onTick(makeTick(chain, 'activity', r, undefined, typeof v?.signature === 'string' ? v.signature : undefined));
        },
      });
      return subscription(conn, [reg]);
    },
  };
}

/** A mock subscription adapter exposes drivers so tests / dev UIs can emit ticks. */
export interface MockSubscriptionAdapter extends SubscriptionAdapter {
  /** Fire every active block subscription on `chain`. */
  emitBlock(chain: ChainId, blockNumber?: bigint): void;
  /** Fire every active address subscription on `chain` matching `address`. */
  emitActivity(chain: ChainId, address: string, hash?: string): void;
  /** Count of currently-active subscriptions (for assertions). */
  activeCount(): number;
}

/** In-memory mock subscription adapter. No network. Drive ticks via emitBlock/emitActivity. */
export function createMockSubscriptionAdapter(): MockSubscriptionAdapter {
  interface BlockSub { chain: ChainId; onTick: (t: ChainTick) => void }
  interface AddrSub { chain: ChainId; address: string; onTick: (t: ChainTick) => void }
  const blockSubs = new Set<BlockSub>();
  const addrSubs = new Set<AddrSub>();

  return {
    async subscribeBlocks(chain, onTick) {
      familyOf(chain); // validate family (throws for unsupported)
      const sub: BlockSub = { chain, onTick };
      blockSubs.add(sub);
      return { async unsubscribe() { blockSubs.delete(sub); } };
    },
    async subscribeAddress(chain, address, onTick) {
      familyOf(chain);
      const sub: AddrSub = { chain, address, onTick };
      addrSubs.add(sub);
      return { async unsubscribe() { addrSubs.delete(sub); } };
    },
    emitBlock(chain, blockNumber) {
      for (const s of blockSubs) if (s.chain === chain) s.onTick(makeTick(chain, 'block', undefined, blockNumber));
    },
    emitActivity(chain, address, hash) {
      for (const s of addrSubs) if (s.chain === chain && s.address === address) s.onTick(makeTick(chain, 'activity', undefined, undefined, hash));
    },
    activeCount: () => blockSubs.size + addrSubs.size,
  };
}
