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