/**
 * @wdk-starter/wdk-web-core/adapters/indexer
 *
 * Transaction history indexer adapter. Phase 1 v1.0 ships ONLY the
 * interface + a mock implementation (createMockIndexerAdapter) per
 * kickoff Part V Step 10 ('indexerGetTransactions adapter (mock first)').
 *
 * Real implementations (Tatum, Covalent, Alchemy, Helius for Solana,
 * custom indexer for Plasma, etc.) are product-level code in v1.1+.
 * They satisfy the IndexerAdapter interface and plug in via dependency
 * injection at the product layer.
 *
 * The mock supports two configurations:
 *   - fixedTransactions: returns the same array on every call (useful
 *     for snapshot-style fixtures)
 *   - onGetTransactions: per-call handler (useful for dynamic fixtures
 *     that derive transactions from the request shape)
 *
 * See: kickoff Part V Step 10, ADR-010.
 */

import type { ChainId } from '../types/index.js';

/** A single transaction record returned by the indexer. */
export interface TransactionRecord {
  /** Transaction hash (hex for EVM, base58 for Solana). */
  readonly hash: string;
  /** Block / slot number the transaction was included in. */
  readonly blockNumber: bigint;
  /** Unix epoch seconds when the block was produced. */
  readonly timestamp: number;
  /** Sender address. */
  readonly from: string;
  /** Recipient address. */
  readonly to: string;
  /** Native value transferred, in base units (wei / lamports). */
  readonly value: bigint;
  /** Final status. 'failed' for reverted EVM or failed Solana transactions. */
  readonly status: 'success' | 'failed';
  /**
   * Optional chain-specific fields a product attaches without changing the
   * chain-agnostic base record (F-INDEXER-01): e.g. EVM `gasUsed`/`effectiveGasPrice`/
   * `logs`/`nonce`, or Solana `computeUnitsConsumed`/`fee`/`slot`. Kept out of the
   * base type so the common record stays portable across families.
   */
  readonly extra?: Record<string, unknown>;
}

export interface GetTransactionsOptions {
  /** Maximum number of records to return (indexer may return fewer). */
  readonly limit?: number;
  /** Earliest block / slot to include (inclusive). */
  readonly fromBlock?: bigint;
  /** Latest block / slot to include (inclusive). */
  readonly toBlock?: bigint;
  /** Opaque cursor from a previous page's `nextCursor` to resume from (B-9). */
  readonly cursor?: string;
}

/** One page of transactions plus the cursor to continue (B-9). */
export interface TransactionPage {
  readonly records: readonly TransactionRecord[];
  /** Pass as `options.cursor` to the next call to continue; absent at the end. */
  readonly nextCursor?: string;
}

export interface IndexerAdapter {
  /** Recent transactions involving the given address on the given chain. */
  getTransactions(
    chain: ChainId,
    address: string,
    options?: GetTransactionsOptions,
  ): Promise<readonly TransactionRecord[]>;
  /**
   * Paged variant (B-9): returns a page of records plus a `nextCursor` to fetch
   * the following page (absent when there are no more). Optional — implemented by
   * adapters that support cursors (e.g. the Etherscan indexer).
   */
  getTransactionsPage?(
    chain: ChainId,
    address: string,
    options?: GetTransactionsOptions,
  ): Promise<TransactionPage>;
}

export interface MockIndexerAdapterOptions {
  /** Fixed list returned on every getTransactions call. */
  readonly fixedTransactions?: readonly TransactionRecord[];
  /** Per-call handler. Overrides fixedTransactions when provided. */
  readonly onGetTransactions?: (
    chain: ChainId,
    address: string,
    options?: GetTransactionsOptions,
  ) => Promise<readonly TransactionRecord[]> | readonly TransactionRecord[];
}

/**
 * Apply the request filters to a fixed record set (B-10). A real indexer honors
 * `fromBlock`/`toBlock`/`limit`; the mock must too, so fixture-driven tests see
 * the same windowing/truncation behavior as production. Records are assumed
 * newest-first (descending blockNumber), matching the real adapters.
 */
function applyIndexerFilters(
  txs: readonly TransactionRecord[],
  opts?: GetTransactionsOptions,
): TransactionRecord[] {
  let out = txs.slice();
  if (opts?.fromBlock !== undefined) out = out.filter((t) => t.blockNumber >= opts.fromBlock!);
  if (opts?.toBlock !== undefined) out = out.filter((t) => t.blockNumber <= opts.toBlock!);
  if (opts?.limit !== undefined) out = out.slice(0, Math.max(0, opts.limit));
  return out;
}

/** In-memory mock indexer. No network. */
export function createMockIndexerAdapter(options: MockIndexerAdapterOptions = {}): IndexerAdapter {
  return {
    async getTransactions(chain, address, opts) {
      if (options.onGetTransactions) {
        // Custom fixture: the handler owns its own filtering.
        return options.onGetTransactions(chain, address, opts);
      }
      // Fixed fixture: enforce the request filters so the mock matches a real
      // indexer's windowing/limit behavior (B-10).
      return applyIndexerFilters(options.fixedTransactions ?? [], opts);
    },
  };
}

/** Config for the Etherscan-v2 EVM indexer (B-2). */
export interface EtherscanIndexerOptions {
  /** Etherscan API key (a single free key works across all v2 chains). Dev-supplied. */
  readonly apiKey: string;
  /** Maps a wdk ChainId to its numeric EVM chain id (the product knows its chains). */
  readonly resolveChainId: (chain: ChainId) => number | Promise<number>;
  /** API base. Default the unified multichain endpoint. */
  readonly baseUrl?: string;
  /** Injectable fetch (tests / non-browser). */
  readonly fetchImpl?: typeof fetch;
}

interface EtherscanTx {
  hash: string;
  blockNumber: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  isError?: string;
  txreceipt_status?: string;
  gasUsed?: string;
  gasPrice?: string;
  nonce?: string;
  methodId?: string;
}

function mapEtherscanTx(r: EtherscanTx): TransactionRecord {
  const failed = r.isError === '1' || r.txreceipt_status === '0';
  return {
    hash: r.hash,
    blockNumber: BigInt(r.blockNumber),
    timestamp: Number(r.timeStamp),
    from: r.from,
    to: r.to,
    value: BigInt(r.value || '0'),
    status: failed ? 'failed' : 'success',
    // Chain-specific fields ride along in `extra` (F-INDEXER-01).
    extra: { gasUsed: r.gasUsed, gasPrice: r.gasPrice, nonce: r.nonce, methodId: r.methodId },
  };
}

/**
 * A real EVM transaction-history indexer over the **Etherscan v2 multichain API**
 * (one key, ~40 EVM chains). Implements {@link IndexerAdapter} for the product's
 * Activity view. The API key + a chain-id resolver are dev-supplied — nothing is
 * hard-coded (template-standard). Solana history (Helius) is a separate adapter.
 */
export function createEtherscanIndexerAdapter(options: EtherscanIndexerOptions): IndexerAdapter {
  const base = options.baseUrl ?? 'https://api.etherscan.io/v2/api';
  const doFetch = options.fetchImpl ?? (globalThis.fetch as typeof fetch | undefined);
  const pageFromCursor = (cursor?: string): number => {
    const n = cursor ? parseInt(cursor, 10) : 1;
    return Number.isFinite(n) && n >= 1 ? n : 1;
  };

  async function fetchTxlist(chain: ChainId, address: string, opts?: GetTransactionsOptions): Promise<TransactionRecord[]> {
    if (typeof doFetch !== 'function') throw new Error('Etherscan indexer: no fetch available; pass options.fetchImpl');
    const chainId = await options.resolveChainId(chain);

    const url = new URL(base);
    url.searchParams.set('chainid', String(chainId));
    url.searchParams.set('module', 'account');
    url.searchParams.set('action', 'txlist');
    url.searchParams.set('address', address);
    url.searchParams.set('sort', 'desc');
    url.searchParams.set('page', String(pageFromCursor(opts?.cursor)));
    if (opts?.fromBlock !== undefined) url.searchParams.set('startblock', String(opts.fromBlock));
    if (opts?.toBlock !== undefined) url.searchParams.set('endblock', String(opts.toBlock));
    if (opts?.limit !== undefined) url.searchParams.set('offset', String(opts.limit));
    url.searchParams.set('apikey', options.apiKey);

    const res = await doFetch(url.toString());
    if (!res.ok) throw new Error('Etherscan indexer HTTP ' + res.status);
    const json = await res.json() as { status?: string; message?: string; result?: unknown };

    // Etherscan returns status "1" + array on success, or status "0" with
    // "No transactions found" (empty, not an error) or a real error message.
    if (json.status !== '1') {
      if (typeof json.message === 'string' && /no transactions/i.test(json.message)) return [];
      throw new Error('Etherscan indexer error: ' + (json.message ?? 'unknown') + ' — ' + (typeof json.result === 'string' ? json.result : ''));
    }
    if (!Array.isArray(json.result)) return [];
    return (json.result as EtherscanTx[]).map(mapEtherscanTx);
  }

  return {
    getTransactions: (chain, address, opts) => fetchTxlist(chain, address, opts),
    async getTransactionsPage(chain, address, opts) {
      const records = await fetchTxlist(chain, address, opts);
      // A full page implies there may be more — advance the page cursor (B-9).
      const more = opts?.limit !== undefined && records.length === opts.limit;
      return more ? { records, nextCursor: String(pageFromCursor(opts?.cursor) + 1) } : { records };
    },
  };
}

/** Config for the standard-RPC Solana indexer (works against any Solana JSON-RPC, e.g. Alchemy). */
export interface SolanaRpcIndexerOptions {
  /** Solana JSON-RPC endpoint URL. Dev-supplied (e.g. an Alchemy Solana URL via env) — never hard-coded. */
  readonly rpcUrl: string;
  /** Injectable fetch (tests / non-browser). */
  readonly fetchImpl?: typeof fetch;
  /**
   * Max `getTransaction` enrichment calls per page (default 25). Enrichment derives
   * from/to/value from each tx's pre/post balances; capping bounds the N+1 cost.
   * Signatures beyond the cap still appear (hash/slot/time/status), just without amounts.
   */
  readonly maxEnrich?: number;
}

interface SolSignature { signature: string; slot: number; blockTime?: number | null; err: unknown }
interface SolTx {
  transaction?: { message?: { accountKeys?: Array<string | { pubkey?: string }> } };
  meta?: { preBalances?: number[]; postBalances?: number[] } | null;
}

/**
 * A real **Solana** transaction-history indexer over standard JSON-RPC
 * (`getSignaturesForAddress` + `getTransaction`), so it works against ANY Solana
 * RPC provider (Alchemy, etc.) — no Helius-specific API needed. Each signature is
 * enriched with the address's native-SOL delta (from pre/post balances) to fill
 * from/to/value (best-effort counterparty); status comes from the tx error. The
 * RPC URL is dev-supplied (template-standard — nothing hard-coded).
 */
export function createSolanaRpcIndexerAdapter(options: SolanaRpcIndexerOptions): IndexerAdapter {
  const doFetch = options.fetchImpl ?? (globalThis.fetch as typeof fetch | undefined);
  const maxEnrich = options.maxEnrich ?? 25;

  async function rpc<T>(method: string, params: unknown[]): Promise<T> {
    if (typeof doFetch !== 'function') throw new Error('Solana indexer: no fetch available; pass options.fetchImpl');
    const res = await doFetch(options.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    if (!res.ok) throw new Error('Solana indexer HTTP ' + res.status);
    const json = await res.json() as { result?: T; error?: { message?: string } };
    if (json.error) throw new Error('Solana RPC error: ' + (json.error.message ?? 'unknown'));
    return json.result as T;
  }

  /** Address native delta + best-effort counterparty from a tx's pre/post balances. */
  function deriveTransfer(tx: SolTx, address: string): { from: string; to: string; value: bigint } {
    const keysRaw = tx.transaction?.message?.accountKeys ?? [];
    const keys = keysRaw.map((k) => (typeof k === 'string' ? k : k.pubkey ?? '')).filter((k): k is string => k.length > 0);
    const pre = tx.meta?.preBalances ?? [];
    const post = tx.meta?.postBalances ?? [];
    const idx = keys.indexOf(address);
    if (idx < 0 || pre.length === 0) return { from: '', to: '', value: 0n };
    const delta = BigInt(post[idx] ?? 0) - BigInt(pre[idx] ?? 0);
    const value = delta < 0n ? -delta : delta;
    let best = -1; let bestMag = 0n;
    for (let i = 0; i < keys.length; i++) {
      if (i === idx) continue;
      const d = BigInt(post[i] ?? 0) - BigInt(pre[i] ?? 0);
      const opposite = (delta < 0n && d > 0n) || (delta > 0n && d < 0n);
      if (!opposite) continue;
      const m = d < 0n ? -d : d;
      if (m > bestMag) { bestMag = m; best = i; }
    }
    const counterparty = best >= 0 ? keys[best]! : '';
    return delta < 0n ? { from: address, to: counterparty, value } : { from: counterparty, to: address, value };
  }

  async function page(address: string, opts?: GetTransactionsOptions): Promise<TransactionPage> {
    const limit = opts?.limit ?? 25;
    const sigParams: Record<string, unknown> = { limit };
    if (opts?.cursor) sigParams.before = opts.cursor; // Solana paginates by signature, not page number
    const sigs = await rpc<SolSignature[]>('getSignaturesForAddress', [address, sigParams]);
    if (!Array.isArray(sigs) || sigs.length === 0) return { records: [] };

    const records: TransactionRecord[] = [];
    let enriched = 0;
    for (const s of sigs) {
      let from = ''; let to = ''; let value = 0n;
      if (enriched < maxEnrich) {
        enriched++;
        const tx = await rpc<SolTx | null>('getTransaction', [s.signature, { maxSupportedTransactionVersion: 0, encoding: 'jsonParsed' }]).catch(() => null);
        if (tx) ({ from, to, value } = deriveTransfer(tx, address));
      }
      records.push({
        hash: s.signature,
        blockNumber: BigInt(s.slot ?? 0),
        timestamp: s.blockTime ?? 0,
        from,
        to,
        value,
        status: s.err ? 'failed' : 'success',
        extra: { slot: s.slot },
      });
    }
    // A full page implies more may exist; the cursor is the last signature (for `before`).
    const nextCursor = sigs.length === limit ? sigs[sigs.length - 1]!.signature : undefined;
    return nextCursor ? { records, nextCursor } : { records };
  }

  return {
    async getTransactions(_chain, address, opts) { return (await page(address, opts)).records; },
    async getTransactionsPage(_chain, address, opts) { return page(address, opts); },
  };
}