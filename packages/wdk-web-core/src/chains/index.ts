/**
 * @wdk-starter/wdk-web-core/chains
 *
 * Chain registry. `chains/index.ts` is the batteries-included default: it
 * eagerly, statically imports every supported chain module and composes them
 * into the full registry via `createChainRegistry` (ADR-012). Consumers that
 * don't care about bundle size import `CHAIN_LOADERS` / `ensureChainRegistered`
 * / `isSupportedChainId` / `SupportedChainId` from here exactly as before.
 *
 * Bundle-conscious consumers (B-12) build their own slim registry from
 * `chains/registry.ts` + only the chain modules they ship, so the bundler
 * tree-shakes the rest. See ADR-012.
 *
 * F-MV3-04: dynamic import() is forbidden on ServiceWorkerGlobalScope (W3C
 * ServiceWorker issue #1356), so chain modules are eagerly static-imported and
 * the loaders return Promise.resolve(<already-imported-module>) to preserve the
 * async ChainLoader contract. Trade-off: the full default registry carries all
 * chains in the initial SW bundle (~360 KB). B-12 / ADR-012 is the opt-in path
 * to slim that per consumer without editing this engine file.
 *
 * Step 4 shipped six chains; B1-2 grew it to 50+. Adding a chain is a single
 * file under src/chains/ plus an entry in FULL_CHAIN_MODULES below.
 *
 * See: ADR-012 (per-consumer registry), PRD 02 Addendum 1.3 (chain-loader
 * pattern), M1 v2 Appendix A Test 02 (Solana register validated in Worker).
 */

// Eager static imports - F-MV3-04: dynamic import() is forbidden in MV3 SW.
import * as _plasmaMainnetMod from './plasma-mainnet.js';
import * as _sepoliaMod from './sepolia.js';
import * as _plasmaTestnetMod from './plasma-testnet.js';
import * as _ethereumMod from './ethereum.js';
import * as _polygonMod from './polygon.js';
import * as _arbitrumMod from './arbitrum.js';
import * as _solanaMod from './solana.js';
// B1-2 bulk-add
import * as _solanaDevnetMod from './solana-devnet.js';
import * as _solanaTestnetMod from './solana-testnet.js';
// Bitcoin (BIP-84 native segwit via @tetherto/wdk-wallet-btc)
import * as _bitcoinMainnetMod from './bitcoin-mainnet.js';
import * as _bitcoinTestnetMod from './bitcoin-testnet.js';
// TON (v5r1 via @tetherto/wdk-wallet-ton)
import * as _tonMainnetMod from './ton.js';
// Tron (via @tetherto/wdk-wallet-tron)
import * as _tronMainnetMod from './tron.js';
import { EVM_BULK_CHAINS } from './_evm-bulk-chains.js';

import { createChainRegistry, type ChainModule } from './registry.js';

export type { ChainModuleMeta } from './types.js';
export type { ChainModule, ChainLoader, ChainRegistry } from './registry.js';
export { createChainRegistry } from './registry.js';

/**
 * The full, batteries-included chain module set. `satisfies` keeps the precise
 * key union (so `SupportedChainId` stays exact) while checking every value is a
 * `ChainModule`. The bulk EVM chains come pre-built from EVM_BULK_CHAINS.
 */
const FULL_CHAIN_MODULES = {
  'plasma-mainnet': _plasmaMainnetMod,
  'sepolia-testnet': _sepoliaMod,
  'plasma-testnet': _plasmaTestnetMod,
  ethereum: _ethereumMod,
  'polygon-mainnet': _polygonMod,
  'arbitrum-mainnet': _arbitrumMod,
  'solana-mainnet': _solanaMod,
  // B1-2: Solana extras (per-file; different wallet engine)
  'solana-devnet': _solanaDevnetMod,
  'solana-testnet': _solanaTestnetMod,
  // Bitcoin (different wallet engine; BIP-84 native segwit)
  'bitcoin-mainnet': _bitcoinMainnetMod,
  'bitcoin-testnet': _bitcoinTestnetMod,
  // TON (v5r1)
  'ton-mainnet': _tonMainnetMod,
  // Tron
  'tron-mainnet': _tronMainnetMod,
  // B1-2: bulk EVM chains - pre-built modules from the EVM_BULK_CHAINS registry.
  'optimism-mainnet': EVM_BULK_CHAINS['optimism-mainnet']!,
  'base-mainnet': EVM_BULK_CHAINS['base-mainnet']!,
  'bsc-mainnet': EVM_BULK_CHAINS['bsc-mainnet']!,
  'avalanche-mainnet': EVM_BULK_CHAINS['avalanche-mainnet']!,
  'gnosis-mainnet': EVM_BULK_CHAINS['gnosis-mainnet']!,
  'celo-mainnet': EVM_BULK_CHAINS['celo-mainnet']!,
  'moonbeam-mainnet': EVM_BULK_CHAINS['moonbeam-mainnet']!,
  'moonriver-mainnet': EVM_BULK_CHAINS['moonriver-mainnet']!,
  'cronos-mainnet': EVM_BULK_CHAINS['cronos-mainnet']!,
  'linea-mainnet': EVM_BULK_CHAINS['linea-mainnet']!,
  'scroll-mainnet': EVM_BULK_CHAINS['scroll-mainnet']!,
  'zksync-mainnet': EVM_BULK_CHAINS['zksync-mainnet']!,
  'polygon-zkevm-mainnet': EVM_BULK_CHAINS['polygon-zkevm-mainnet']!,
  'mantle-mainnet': EVM_BULK_CHAINS['mantle-mainnet']!,
  'blast-mainnet': EVM_BULK_CHAINS['blast-mainnet']!,
  'mode-mainnet': EVM_BULK_CHAINS['mode-mainnet']!,
  'metis-mainnet': EVM_BULK_CHAINS['metis-mainnet']!,
  'worldchain-mainnet': EVM_BULK_CHAINS['worldchain-mainnet']!,
  'sonic-mainnet': EVM_BULK_CHAINS['sonic-mainnet']!,
  'boba-mainnet': EVM_BULK_CHAINS['boba-mainnet']!,
  'zora-mainnet': EVM_BULK_CHAINS['zora-mainnet']!,
  'manta-pacific-mainnet': EVM_BULK_CHAINS['manta-pacific-mainnet']!,
  'taiko-mainnet': EVM_BULK_CHAINS['taiko-mainnet']!,
  'berachain-mainnet': EVM_BULK_CHAINS['berachain-mainnet']!,
  'abstract-mainnet': EVM_BULK_CHAINS['abstract-mainnet']!,
  'ink-mainnet': EVM_BULK_CHAINS['ink-mainnet']!,
  'unichain-mainnet': EVM_BULK_CHAINS['unichain-mainnet']!,
  'soneium-mainnet': EVM_BULK_CHAINS['soneium-mainnet']!,
  'holesky-testnet': EVM_BULK_CHAINS['holesky-testnet']!,
  'hoodi-testnet': EVM_BULK_CHAINS['hoodi-testnet']!,
  'optimism-sepolia-testnet': EVM_BULK_CHAINS['optimism-sepolia-testnet']!,
  'base-sepolia-testnet': EVM_BULK_CHAINS['base-sepolia-testnet']!,
  'arbitrum-sepolia-testnet': EVM_BULK_CHAINS['arbitrum-sepolia-testnet']!,
  'polygon-amoy-testnet': EVM_BULK_CHAINS['polygon-amoy-testnet']!,
  'avalanche-fuji-testnet': EVM_BULK_CHAINS['avalanche-fuji-testnet']!,
  'bsc-testnet': EVM_BULK_CHAINS['bsc-testnet']!,
  'linea-sepolia-testnet': EVM_BULK_CHAINS['linea-sepolia-testnet']!,
  'scroll-sepolia-testnet': EVM_BULK_CHAINS['scroll-sepolia-testnet']!,
  'zksync-sepolia-testnet': EVM_BULK_CHAINS['zksync-sepolia-testnet']!,
  'mantle-sepolia-testnet': EVM_BULK_CHAINS['mantle-sepolia-testnet']!,
  'blast-sepolia-testnet': EVM_BULK_CHAINS['blast-sepolia-testnet']!,
  'moonbase-alpha-testnet': EVM_BULK_CHAINS['moonbase-alpha-testnet']!,
} satisfies Record<string, ChainModule>;

/** The default, full registry — every supported chain (ADR-012). */
const fullRegistry = createChainRegistry(FULL_CHAIN_MODULES);

/**
 * Registry of chain loaders for every supported chain. Each value is a thunk
 * that resolves the chain module.
 */
export const CHAIN_LOADERS = fullRegistry.CHAIN_LOADERS;

/**
 * The subset of ChainId values that have a registered loader. Use this as the
 * parameter type for functions that need to load a chain.
 */
export type SupportedChainId = keyof typeof FULL_CHAIN_MODULES;

/** Type guard: returns true if `chainId` has a registered loader. */
export const isSupportedChainId = fullRegistry.isSupportedChainId;

/**
 * Ensures the given chain is registered with the WDK orchestrator. Idempotent
 * per (wdk, chainId); resolves the chain module on first call and calls
 * wdk.registerWallet with its default export + config. See ADR-008, F-WDK-04.
 */
export const ensureChainRegistered = fullRegistry.ensureChainRegistered;
