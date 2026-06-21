/**
 * @wdk-starter/wdk-web-core/adapters/rpc
 *
 * RPC adapter abstraction. Two implementations:
 *
 *   - createHttpRpcAdapter: production-ready HTTP backend. Routes by chain
 *     family - EVM goes through viem.createPublicClient (handles JSON-RPC
 *     envelope + hex-balance decoding), Solana goes through a direct
 *     JSON-RPC POST (we do not pull @solana/rpc as a direct dep just for
 *     getBalance; the wire format is simple). RPC URLs are read from the
 *     chain module configs registered in CHAIN_LOADERS.
 *
 *   - createMockRpcAdapter: in-memory fake for tests + dev fixtures.
 *     Supports a balances Map for static fixtures or a per-call handler
 *     for dynamic responses.
 *
 * Phase 1 v1.0 carryover: getTokenBalance for Solana SPL tokens is
 * deferred to v1.1 (requires associated-token-account resolution which
 * is non-trivial and not exercised by Phase 1 product surfaces). EVM
 * getTokenBalance is implemented via standard ERC-20 balanceOf.
 *
 * See: kickoff Part V Step 10, ADR-010 (consumer abstraction shape).
 */

import { createPublicClient, http, type Address, type PublicClient } from 'viem';
import { withRetry } from './retry.js';
import { CHAIN_LOADERS, isSupportedChainId } from '../chains/index.js';
import type { ChainId } from '../types/index.js';

/** Lifecycle of a broadcast transaction as observed on-chain. */
export type TransactionStatus = 'pending' | 'success' | 'failed';

export interface RpcAdapter {
  /** Native-token balance: wei for EVM, lamports for Solana. */
  getBalance(chain: ChainId, address: string): Promise<bigint>;
  /** Token balance in base units. EVM uses ERC-20 balanceOf; Solana is v1.1. */
  getTokenBalance(chain: ChainId, address: string, tokenAddress: string): Promise<bigint>;
  /**
   * On-chain status of a broadcast transaction. EVM reads the receipt
   * (success/reverted); Solana reads signature statuses. 'pending' means not
   * yet mined/confirmed (or temporarily unreadable) — safe to keep polling.
   */
  getTransactionStatus(chain: ChainId, hash: string): Promise<TransactionStatus>;
}

const ERC20_BALANCE_OF_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_owner', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
] as const;

/** Production HTTP RPC adapter. Routes per chain family via CHAIN_LOADERS lookup. */
export function createHttpRpcAdapter(): RpcAdapter {
  // Per-adapter viem client cache. Avoids constructing a new PublicClient
  // for every getBalance call. Keyed by chain:rpcUrl so reconfigured chains
  // get a fresh client.
  const evmClientCache = new Map<string, PublicClient>();

  function getEvmClient(chain: string, rpcUrl: string): PublicClient {
    const key = chain + ':' + rpcUrl;
    let client = evmClientCache.get(key);
    if (!client) {
      client = createPublicClient({ transport: http(rpcUrl) });
      evmClientCache.set(key, client);
    }
    return client;
  }

  async function resolveChainConfig(chain: ChainId): Promise<{ family: string; rpcUrl: string }> {
    if (!isSupportedChainId(chain)) {
      throw new Error('Unsupported chain (no loader registered): ' + chain);
    }
    const mod = await CHAIN_LOADERS[chain]();
    const family = mod.meta.family;
    const rpcUrl = (mod.config as { rpcUrl?: unknown }).rpcUrl;
    if (typeof rpcUrl !== 'string') {
      throw new Error('Chain config missing rpcUrl string: ' + chain);
    }
    return { family, rpcUrl };
  }

  return {
    async getBalance(chain, address) {
      const { family, rpcUrl } = await resolveChainConfig(chain);
      if (family === 'evm') {
        const client = getEvmClient(chain, rpcUrl);
        // Idempotent read — retry transient RPC failures (B-6).
        return withRetry(() => client.getBalance({ address: address as Address }));
      }
      if (family === 'solana') {
        return withRetry(() => getSolanaNativeBalance(rpcUrl, address));
      }
      throw new Error('Unknown chain family: ' + family);
    },

    async getTokenBalance(chain, address, tokenAddress) {
      const { family, rpcUrl } = await resolveChainConfig(chain);
      if (family === 'evm') {
        const client = getEvmClient(chain, rpcUrl);
        const balance = await withRetry(() => client.readContract({
          address: tokenAddress as Address,
          abi: ERC20_BALANCE_OF_ABI,
          functionName: 'balanceOf',
          args: [address as Address],
        }));
        return balance;
      }
      if (family === 'solana') {
        throw new Error('Solana SPL token balance deferred to v1.1 (requires ATA resolution); use a product-level @solana/spl-token adapter for now.');
      }
      throw new Error('Unknown chain family: ' + family);
    },

    async getTransactionStatus(chain, hash) {
      const { family, rpcUrl } = await resolveChainConfig(chain);
      if (family === 'evm') {
        const client = getEvmClient(chain, rpcUrl);
        try {
          const receipt = await client.getTransactionReceipt({ hash: hash as `0x${string}` });
          return receipt.status === 'success' ? 'success' : 'failed';
        } catch {
          // Receipt not found yet (unmined) or transient RPC error — keep polling.
          return 'pending';
        }
      }
      if (family === 'solana') {
        return getSolanaSignatureStatus(rpcUrl, hash);
      }
      throw new Error('Unknown chain family: ' + family);
    },
  };
}

async function getSolanaSignatureStatus(rpcUrl: string, signature: string): Promise<TransactionStatus> {
  let data: { result?: { value?: Array<{ confirmationStatus?: string; err?: unknown } | null> } };
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getSignatureStatuses',
        params: [[signature], { searchTransactionHistory: true }],
      }),
    });
    if (!response.ok) return 'pending';
    data = await response.json() as typeof data;
  } catch {
    return 'pending';
  }
  const entry = data.result?.value?.[0];
  if (!entry) return 'pending';
  if (entry.err) return 'failed';
  if (entry.confirmationStatus === 'confirmed' || entry.confirmationStatus === 'finalized') return 'success';
  return 'pending';
}

async function getSolanaNativeBalance(rpcUrl: string, address: string): Promise<bigint> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getBalance',
      params: [address],
    }),
  });
  if (!response.ok) {
    throw new Error('Solana RPC HTTP error: ' + response.status + ' ' + response.statusText);
  }
  const data = await response.json() as { result?: { value?: number | string }; error?: { message?: string } };
  if (data.error) {
    throw new Error('Solana RPC error: ' + (data.error.message ?? JSON.stringify(data.error)));
  }
  if (data.result?.value === undefined || data.result.value === null) {
    throw new Error('Solana RPC response missing result.value: ' + JSON.stringify(data));
  }
  return BigInt(data.result.value);
}

/** Configuration for the mock RPC adapter (tests + dev fixtures). */
export interface MockRpcAdapterOptions {
  /** Pre-populated balances. Key format: 'chainId:address'. */
  readonly balances?: ReadonlyMap<string, bigint>;
  /** Pre-populated token balances. Key format: 'chainId:address:tokenAddress'. */
  readonly tokenBalances?: ReadonlyMap<string, bigint>;
  /** Optional per-call handler for getBalance. Overrides balances Map when provided. */
  readonly onGetBalance?: (chain: ChainId, address: string) => Promise<bigint> | bigint;
  /** Optional per-call handler for getTokenBalance. Overrides tokenBalances Map when provided. */
  readonly onGetTokenBalance?: (chain: ChainId, address: string, tokenAddress: string) => Promise<bigint> | bigint;
  /** Pre-populated transaction statuses. Key format: 'chainId:hash'. Defaults to 'pending'. */
  readonly transactionStatuses?: ReadonlyMap<string, TransactionStatus>;
  /** Optional per-call handler for getTransactionStatus. Overrides the map when provided. */
  readonly onGetTransactionStatus?: (chain: ChainId, hash: string) => Promise<TransactionStatus> | TransactionStatus;
}

/** In-memory mock RPC adapter. Used in tests + dev fixtures. No network. */
export function createMockRpcAdapter(options: MockRpcAdapterOptions = {}): RpcAdapter {
  return {
    async getBalance(chain, address) {
      if (options.onGetBalance) return options.onGetBalance(chain, address);
      return options.balances?.get(chain + ':' + address) ?? 0n;
    },
    async getTokenBalance(chain, address, tokenAddress) {
      if (options.onGetTokenBalance) return options.onGetTokenBalance(chain, address, tokenAddress);
      return options.tokenBalances?.get(chain + ':' + address + ':' + tokenAddress) ?? 0n;
    },
    async getTransactionStatus(chain, hash) {
      if (options.onGetTransactionStatus) return options.onGetTransactionStatus(chain, hash);
      return options.transactionStatuses?.get(chain + ':' + hash) ?? 'pending';
    },
  };
}