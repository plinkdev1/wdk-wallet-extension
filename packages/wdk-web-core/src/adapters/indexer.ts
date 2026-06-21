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
}

export interface IndexerAdapter {
  /** Recent transactions involving the given address on the given chain. */
  getTransactions(
    chain: ChainId,
    address: string,
    options?: GetTransactionsOptions,
  ): Promise<readonly TransactionRecord[]>;
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

/** In-memory mock indexer. No network. */
export function createMockIndexerAdapter(options: MockIndexerAdapterOptions = {}): IndexerAdapter {
  return {
    async getTransactions(chain, address, opts) {
      if (options.onGetTransactions) {
        return options.onGetTransactions(chain, address, opts);
      }
      return options.fixedTransactions ?? [];
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

  return {
    async getTransactions(chain, address, opts) {
      if (typeof doFetch !== 'function') throw new Error('Etherscan indexer: no fetch available; pass options.fetchImpl');
      const chainId = await options.resolveChainId(chain);

      const url = new URL(base);
      url.searchParams.set('chainid', String(chainId));
      url.searchParams.set('module', 'account');
      url.searchParams.set('action', 'txlist');
      url.searchParams.set('address', address);
      url.searchParams.set('sort', 'desc');
      if (opts?.fromBlock !== undefined) url.searchParams.set('startblock', String(opts.fromBlock));
      if (opts?.toBlock !== undefined) url.searchParams.set('endblock', String(opts.toBlock));
      if (opts?.limit !== undefined) {
        url.searchParams.set('page', '1');
        url.searchParams.set('offset', String(opts.limit));
      }
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
    },
  };
}