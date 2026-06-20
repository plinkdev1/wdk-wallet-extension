/**
 * Chain identifier types.
 *
 * Chain identifiers (e.g., 'plasma-mainnet', 'ethereum', 'solana-mainnet') are
 * the keys used throughout wdk-web-core to address chain modules. As of P2-Cat1
 * they are derived from `as const` tuples (EVM_CHAIN_IDS / SOLANA_CHAIN_IDS) so
 * the type system stays in lockstep with the runtime list - the v0.2 chain-
 * selector UI iterates these same tuples to populate its options.
 *
 * The tuples are typed `as const satisfies readonly string[]` to lock the
 * literal entries while keeping a generic constraint that catches typos in
 * future additions.
 *
 * See: ADR-009 (BIP-44 derivation paths), PRD 02 Addendum 1.3 (chain-loader pattern).
 */

/**
 * Canonical list of EVM chain identifiers. All entries use BIP-44 coin type 60.
 *
 * Naming convention: `<chain>-mainnet` / `<chain>-testnet`. The bare 'ethereum'
 * entry is preserved historically; future additions should follow the suffix
 * convention for clarity (e.g. 'sepolia-testnet', not 'sepolia').
 *
 * Chain modules registered in chains/index.ts CHAIN_LOADERS in v0.1:
 *   ethereum, plasma-mainnet, plasma-testnet, polygon-mainnet, arbitrum-mainnet.
 * Optimism / Base / BSC are typed but not yet wired to runtime loaders -
 * dapp-handlers.ts treats them as known for EIP-3085 popup rendering, but
 * ensureChainRegistered() throws if a consumer tries to use them. They graduate
 * to runtime support when v0.2 ships matching chain modules under chains/.
 */
export const EVM_CHAIN_IDS = [
  'ethereum',
  'plasma-mainnet',
  'plasma-testnet',
  'sepolia-testnet',
  'polygon-mainnet',
  'arbitrum-mainnet',
  'optimism-mainnet',
  'base-mainnet',
  'bsc-mainnet',
  // B1-2: bulk-add - 39 new EVM chain ids (28 mainnets + 11 testnets net,
  // since optimism/base/bsc-mainnet were already typed). See chains/_evm-bulk-chains.ts.
  'avalanche-mainnet',
  'gnosis-mainnet',
  'celo-mainnet',
  'moonbeam-mainnet',
  'moonriver-mainnet',
  'cronos-mainnet',
  'linea-mainnet',
  'scroll-mainnet',
  'zksync-mainnet',
  'polygon-zkevm-mainnet',
  'mantle-mainnet',
  'blast-mainnet',
  'mode-mainnet',
  'metis-mainnet',
  'worldchain-mainnet',
  'sonic-mainnet',
  'boba-mainnet',
  'zora-mainnet',
  'manta-pacific-mainnet',
  'taiko-mainnet',
  'berachain-mainnet',
  'abstract-mainnet',
  'ink-mainnet',
  'unichain-mainnet',
  'soneium-mainnet',
  'holesky-testnet',
  'hoodi-testnet',
  'optimism-sepolia-testnet',
  'base-sepolia-testnet',
  'arbitrum-sepolia-testnet',
  'polygon-amoy-testnet',
  'avalanche-fuji-testnet',
  'bsc-testnet',
  'linea-sepolia-testnet',
  'scroll-sepolia-testnet',
  'zksync-sepolia-testnet',
  'mantle-sepolia-testnet',
  'blast-sepolia-testnet',
  'moonbase-alpha-testnet',
] as const satisfies readonly string[];

/** EVM chain identifiers (all chains using BIP-44 coin type 60). */
export type EvmChainId = typeof EVM_CHAIN_IDS[number];

/**
 * Canonical list of Solana chain identifiers. All entries use BIP-44 coin
 * type 501. v0.1 ships a loader for solana-mainnet only; solana-devnet is
 * typed but its loader is deferred (see chains/solana.ts).
 */
export const SOLANA_CHAIN_IDS = [
  'solana-mainnet',
  'solana-devnet',
  'solana-testnet',  // B1-2
] as const satisfies readonly string[];

/** Solana chain identifiers (BIP-44 coin type 501). */
export type SolanaChainId = typeof SOLANA_CHAIN_IDS[number];

/** Any supported chain identifier. */
export type ChainId = EvmChainId | SolanaChainId;

/**
 * Chain family discriminant - used for runtime routing in worker handlers
 * and for code-splitting boundaries in the chain-loader registry.
 */
export type ChainFamily = 'evm' | 'solana';

/** Map a ChainId to its family at the type level. */
export type ChainFamilyOf<T extends ChainId> = T extends EvmChainId
  ? 'evm'
  : T extends SolanaChainId
    ? 'solana'
    : never;