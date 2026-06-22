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
 * getTokenBalance: EVM via standard ERC-20 balanceOf; Solana sums the owner's
 * SPL token accounts for the mint via getTokenAccountsByOwner (B-1).
 *
 * See: kickoff Part V Step 10, ADR-010 (consumer abstraction shape).
 */

import { createPublicClient, http, defineChain, type Address, type PublicClient } from 'viem';
import { withRetry } from './retry.js';
import { RateLimiter, type RateLimiterOptions } from './rate-limit.js';

/** Options for the HTTP RPC adapter. */
export interface HttpRpcAdapterOptions {
  /**
   * Optional client-side rate limit (token bucket) in front of every RPC call
   * (B-7). Useful on free-tier endpoints that 429 under the concurrent bursts
   * getTokenBalances can produce. Off by default.
   */
  readonly rateLimit?: RateLimiterOptions;
  /**
   * Per-chain RPC URL overrides, keyed by ChainId. A dev-supplied keyed endpoint
   * (e.g. an Alchemy/Infura URL from an env var) takes precedence over the chain
   * config's baked-in public default — so a consumer can point any chain at its
   * own RPC without rebuilding chain modules. The public default is only a
   * fallback for unconfigured chains.
   */
  readonly rpcUrls?: Readonly<Record<string, string>>;
  /**
   * Resolver form of {@link rpcUrls} for full control (e.g. multi-endpoint
   * selection). Takes precedence when it returns a string; falls back to
   * `rpcUrls`, then the chain config default.
   */
  readonly resolveRpcUrl?: (chain: ChainId) => string | undefined;
}
import { CHAIN_LOADERS, isSupportedChainId } from '../chains/index.js';
import type { ChainId } from '../types/index.js';

/** Lifecycle of a broadcast transaction as observed on-chain. */
export type TransactionStatus = 'pending' | 'success' | 'failed';

export interface RpcAdapter {
  /** Native-token balance: wei for EVM, lamports for Solana. */
  getBalance(chain: ChainId, address: string): Promise<bigint>;
  /** Token balance in base units. EVM via ERC-20 balanceOf; Solana via SPL accounts. */
  getTokenBalance(chain: ChainId, address: string, tokenAddress: string): Promise<bigint>;
  /**
   * Batched token balances on one chain — issued concurrently so N balances cost
   * ~one round-trip of latency instead of N sequential (B-5). Returns base-unit
   * balances in the same order as `tokenAddresses`. Optional: implemented by the
   * HTTP + mock adapters. (A single Multicall3 call is a further optimization.)
   */
  getTokenBalances?(chain: ChainId, address: string, tokenAddresses: readonly string[]): Promise<bigint[]>;
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

/** Canonical Multicall3 — deployed at the same address on virtually every EVM chain. */
const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11' as const;

/** Minimal EVM chain metadata pulled from a chain config, used to spec the viem client (B-3). */
interface EvmChainMeta {
  readonly chainId: number;
  readonly name: string;
  readonly nativeSymbol: string;
  readonly nativeDecimals: number;
}

/** Production HTTP RPC adapter. Routes per chain family via CHAIN_LOADERS lookup. */
export function createHttpRpcAdapter(options: HttpRpcAdapterOptions = {}): RpcAdapter {
  // Per-adapter viem client cache. Avoids constructing a new PublicClient
  // for every getBalance call. Keyed by chain:rpcUrl so reconfigured chains
  // get a fresh client.
  const evmClientCache = new Map<string, PublicClient>();

  // Optional client-side rate limit + retry (B-6/B-7) around every network call.
  const limiter = options.rateLimit ? new RateLimiter(options.rateLimit) : undefined;
  function run<T>(fn: () => Promise<T>): Promise<T> {
    return withRetry(() => (limiter ? limiter.schedule(fn) : fn()));
  }

  function getEvmClient(chain: string, rpcUrl: string, evm?: EvmChainMeta): PublicClient {
    const key = chain + ':' + rpcUrl;
    let client = evmClientCache.get(key);
    if (!client) {
      // B-3 / F-RPC-02: give viem the chain spec (id + native currency + Multicall3),
      // derived from the chain config rather than a hardcoded per-chain table, so
      // multicall, gas estimation, and EIP-1559 have correct context.
      const chainSpec = evm
        ? defineChain({
            id: evm.chainId,
            name: evm.name,
            nativeCurrency: { name: evm.nativeSymbol, symbol: evm.nativeSymbol, decimals: evm.nativeDecimals },
            rpcUrls: { default: { http: [rpcUrl] } },
            contracts: { multicall3: { address: MULTICALL3_ADDRESS } },
          })
        : undefined;
      client = createPublicClient(chainSpec ? { chain: chainSpec, transport: http(rpcUrl) } : { transport: http(rpcUrl) });
      evmClientCache.set(key, client);
    }
    return client;
  }

  async function resolveChainConfig(chain: ChainId): Promise<{ family: string; rpcUrl: string; evm?: EvmChainMeta }> {
    if (!isSupportedChainId(chain)) {
      throw new Error('Unsupported chain (no loader registered): ' + chain);
    }
    const mod = await CHAIN_LOADERS[chain]();
    const family = mod.meta.family;
    // A dev-supplied override (keyed endpoint via env) wins over the chain
    // config's public default; the default is only the fallback.
    const override = options.resolveRpcUrl?.(chain) ?? options.rpcUrls?.[chain];
    const rpcUrl = override ?? (mod.config as { rpcUrl?: unknown }).rpcUrl;
    if (typeof rpcUrl !== 'string') {
      throw new Error('Chain config missing rpcUrl string: ' + chain);
    }
    let evm: EvmChainMeta | undefined;
    if (family === 'evm') {
      const chainId = (mod.config as { chainId?: unknown }).chainId;
      const meta = mod.meta as { name?: unknown; nativeCurrency?: { symbol?: unknown; decimals?: unknown } };
      if (typeof chainId === 'number') {
        evm = {
          chainId,
          name: typeof meta.name === 'string' ? meta.name : String(chain),
          nativeSymbol: typeof meta.nativeCurrency?.symbol === 'string' ? meta.nativeCurrency.symbol : 'ETH',
          nativeDecimals: typeof meta.nativeCurrency?.decimals === 'number' ? meta.nativeCurrency.decimals : 18,
        };
      }
    }
    return { family, rpcUrl, ...(evm ? { evm } : {}) };
  }

  async function tokenBalance(chain: ChainId, address: string, tokenAddress: string): Promise<bigint> {
    const { family, rpcUrl, evm } = await resolveChainConfig(chain);
    if (family === 'evm') {
      const client = getEvmClient(chain, rpcUrl, evm);
      return run(() => client.readContract({
        address: tokenAddress as Address,
        abi: ERC20_BALANCE_OF_ABI,
        functionName: 'balanceOf',
        args: [address as Address],
      }));
    }
    if (family === 'solana') {
      // SPL balance: sum the owner's token accounts for this mint (B-1).
      return run(() => getSolanaTokenBalance(rpcUrl, address, tokenAddress));
    }
    throw new Error('Unknown chain family: ' + family);
  }

  return {
    async getBalance(chain, address) {
      const { family, rpcUrl, evm } = await resolveChainConfig(chain);
      if (family === 'evm') {
        const client = getEvmClient(chain, rpcUrl, evm);
        // Idempotent read — retry transient RPC failures (B-6) + optional rate limit (B-7).
        return run(() => client.getBalance({ address: address as Address }));
      }
      if (family === 'solana') {
        return run(() => getSolanaNativeBalance(rpcUrl, address));
      }
      throw new Error('Unknown chain family: ' + family);
    },

    getTokenBalance: tokenBalance,

    async getTokenBalances(chain, address, tokenAddresses) {
      if (tokenAddresses.length === 0) return [];
      const { family, rpcUrl, evm } = await resolveChainConfig(chain);
      if (family === 'evm') {
        // One Multicall3 round-trip for all balances (B-5 + B-3), not N calls.
        const client = getEvmClient(chain, rpcUrl, evm);
        const results = await run(() => client.multicall({
          contracts: tokenAddresses.map((t) => ({
            address: t as Address,
            abi: ERC20_BALANCE_OF_ABI,
            functionName: 'balanceOf',
            args: [address as Address],
          } as const)),
          multicallAddress: MULTICALL3_ADDRESS,
          allowFailure: true,
        }));
        return results.map((r) => (r.status === 'success' ? (r.result as bigint) : 0n));
      }
      // Non-EVM: concurrent reads.
      return Promise.all(tokenAddresses.map((t) => tokenBalance(chain, address, t)));
    },

    async getTransactionStatus(chain, hash) {
      const { family, rpcUrl, evm } = await resolveChainConfig(chain);
      if (family === 'evm') {
        const client = getEvmClient(chain, rpcUrl, evm);
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
  // Read the raw text first so we can extract the u64 lamports as a precise
  // integer string. response.json() would parse it to a JS Number and silently
  // lose precision above 2^53 (~9M SOL) — F-RPC-01. We still JSON.parse for the
  // error/shape checks.
  const text = await response.text();
  const data = JSON.parse(text) as { result?: { value?: number | string }; error?: { message?: string } };
  if (data.error) {
    throw new Error('Solana RPC error: ' + (data.error.message ?? JSON.stringify(data.error)));
  }
  if (data.result?.value === undefined || data.result.value === null) {
    throw new Error('Solana RPC response missing result.value: ' + JSON.stringify(data));
  }
  // Precise extraction from the raw text (handles number- or string-encoded value).
  const lamports = /"value"\s*:\s*"?(\d+)"?/.exec(text)?.[1];
  return lamports !== undefined ? BigInt(lamports) : BigInt(data.result.value);
}

/**
 * SPL token balance for an owner + mint (B-1). Queries `getTokenAccountsByOwner`
 * (jsonParsed) and sums every matching token account — an owner can hold a mint
 * across more than one account, and the total is the spendable balance. Amounts
 * come back as decimal strings, so there's no JS-Number precision loss. Returns
 * 0n when the owner holds no account for the mint.
 */
async function getSolanaTokenBalance(rpcUrl: string, owner: string, mint: string): Promise<bigint> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTokenAccountsByOwner',
      params: [owner, { mint }, { encoding: 'jsonParsed' }],
    }),
  });
  if (!response.ok) {
    throw new Error('Solana RPC HTTP error: ' + response.status + ' ' + response.statusText);
  }
  const data = await response.json() as {
    result?: { value?: ReadonlyArray<{ account?: { data?: { parsed?: { info?: { tokenAmount?: { amount?: string } } } } } }> };
    error?: { message?: string };
  };
  if (data.error) {
    throw new Error('Solana RPC error: ' + (data.error.message ?? JSON.stringify(data.error)));
  }
  let total = 0n;
  for (const entry of data.result?.value ?? []) {
    const amount = entry.account?.data?.parsed?.info?.tokenAmount?.amount;
    if (typeof amount === 'string' && /^\d+$/.test(amount)) {
      total += BigInt(amount);
    }
  }
  return total;
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
  async function tokenBalance(chain: ChainId, address: string, tokenAddress: string): Promise<bigint> {
    if (options.onGetTokenBalance) return options.onGetTokenBalance(chain, address, tokenAddress);
    return options.tokenBalances?.get(chain + ':' + address + ':' + tokenAddress) ?? 0n;
  }
  return {
    async getBalance(chain, address) {
      if (options.onGetBalance) return options.onGetBalance(chain, address);
      return options.balances?.get(chain + ':' + address) ?? 0n;
    },
    getTokenBalance: tokenBalance,
    async getTokenBalances(chain, address, tokenAddresses) {
      return Promise.all(tokenAddresses.map((t) => tokenBalance(chain, address, t)));
    },
    async getTransactionStatus(chain, hash) {
      if (options.onGetTransactionStatus) return options.onGetTransactionStatus(chain, hash);
      return options.transactionStatuses?.get(chain + ':' + hash) ?? 'pending';
    },
  };
}