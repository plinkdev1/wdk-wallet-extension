/**
 * @wdk-starter/wdk-web-core/chains
 *
 * Chain loader registry. Each entry in CHAIN_LOADERS is a thunk that
 * dynamically imports the chain module on first call. Vite/Rollup/webpack
 * each emit a separate bundle chunk per dynamic import call, so users on
 * Plasma-only never download Solana code (~80 KB gzipped saved per Phase 0
 * F-BUNDLE-01 measurement).
 *
 * Step 4 ships six chains (5 EVM + Solana mainnet). Adding new chains in
 * Phase 1 v1.1+ is a single-file addition under src/chains/ plus an entry
 * in CHAIN_LOADERS below.
 *
 * See: PRD 02 Addendum 1.3 (chain-loader pattern), 2.3 (F-WDK-04 cast),
 * M1 v2 Appendix A Test 02 (Solana register validated in Worker context).
 */

import type WDK from '@tetherto/wdk';
import type { ChainId } from '../types/chains.js';
import type { ChainModuleMeta } from './types.js';

// Eager static imports - see CHAIN_LOADERS block below for the why.
// F-MV3-04: dynamic import() is forbidden in MV3 SW (W3C SW issue #1356).
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

export type { ChainModuleMeta } from './types.js';

/**
 * A chain loader is a thunk that lazy-imports the chain module. The chain
 * module exports `default` (the wallet manager class), `config` (the runtime
 * config WDK consumes), and `meta` (display metadata).
 */
export type ChainLoader = () => Promise<{
  readonly default: unknown;
  readonly config: Record<string, unknown>;
  readonly meta: ChainModuleMeta;
}>;

/**
 * Registry of lazy-loadable chain modules. Each entry is a thunk that returns
 * the chain module on first call.
 */
// MV3 SW restriction (F-MV3-04): dynamic import() is disallowed on
// ServiceWorkerGlobalScope per W3C/ServiceWorker issue #1356. The chain
// modules above are now eagerly statically imported, and the "loaders"
// return Promise.resolve(<already-imported-module>) to preserve the
// async ChainLoader API contract.
//
// Trade-off: this defeats F-BUNDLE-01 lazy chunking - all chains are
// in the initial SW bundle (~360 KB extra). Acceptable in v1.0 because
// the SW chunk loads once per browser session. Phase 1 v1.1 can
// reintroduce per-consumer registry overrides if bundle size becomes
// an issue (e.g., Next.js template wants to keep F-BUNDLE-01 lazy).
export const CHAIN_LOADERS = {
  'plasma-mainnet': () => Promise.resolve(_plasmaMainnetMod),
  'sepolia-testnet': () => Promise.resolve(_sepoliaMod),
  'plasma-testnet': () => Promise.resolve(_plasmaTestnetMod),
  ethereum: () => Promise.resolve(_ethereumMod),
  'polygon-mainnet': () => Promise.resolve(_polygonMod),
  'arbitrum-mainnet': () => Promise.resolve(_arbitrumMod),
  'solana-mainnet': () => Promise.resolve(_solanaMod),
  // B1-2: Solana extras (per-file; different wallet engine)
  'solana-devnet': () => Promise.resolve(_solanaDevnetMod),
  'solana-testnet': () => Promise.resolve(_solanaTestnetMod),
  // Bitcoin (different wallet engine; BIP-84 native segwit)
  'bitcoin-mainnet': () => Promise.resolve(_bitcoinMainnetMod),
  'bitcoin-testnet': () => Promise.resolve(_bitcoinTestnetMod),
  // TON (v5r1)
  'ton-mainnet': () => Promise.resolve(_tonMainnetMod),
  // Tron
  'tron-mainnet': () => Promise.resolve(_tronMainnetMod),
  // B1-2: bulk EVM chains - each loader returns the pre-built module from
  // the EVM_BULK_CHAINS registry. F-MV3-04 compatible (no dynamic import()).
  'optimism-mainnet': () => Promise.resolve(EVM_BULK_CHAINS['optimism-mainnet']!),
  'base-mainnet': () => Promise.resolve(EVM_BULK_CHAINS['base-mainnet']!),
  'bsc-mainnet': () => Promise.resolve(EVM_BULK_CHAINS['bsc-mainnet']!),
  'avalanche-mainnet': () => Promise.resolve(EVM_BULK_CHAINS['avalanche-mainnet']!),
  'gnosis-mainnet': () => Promise.resolve(EVM_BULK_CHAINS['gnosis-mainnet']!),
  'celo-mainnet': () => Promise.resolve(EVM_BULK_CHAINS['celo-mainnet']!),
  'moonbeam-mainnet': () => Promise.resolve(EVM_BULK_CHAINS['moonbeam-mainnet']!),
  'moonriver-mainnet': () => Promise.resolve(EVM_BULK_CHAINS['moonriver-mainnet']!),
  'cronos-mainnet': () => Promise.resolve(EVM_BULK_CHAINS['cronos-mainnet']!),
  'linea-mainnet': () => Promise.resolve(EVM_BULK_CHAINS['linea-mainnet']!),
  'scroll-mainnet': () => Promise.resolve(EVM_BULK_CHAINS['scroll-mainnet']!),
  'zksync-mainnet': () => Promise.resolve(EVM_BULK_CHAINS['zksync-mainnet']!),
  'polygon-zkevm-mainnet': () => Promise.resolve(EVM_BULK_CHAINS['polygon-zkevm-mainnet']!),
  'mantle-mainnet': () => Promise.resolve(EVM_BULK_CHAINS['mantle-mainnet']!),
  'blast-mainnet': () => Promise.resolve(EVM_BULK_CHAINS['blast-mainnet']!),
  'mode-mainnet': () => Promise.resolve(EVM_BULK_CHAINS['mode-mainnet']!),
  'metis-mainnet': () => Promise.resolve(EVM_BULK_CHAINS['metis-mainnet']!),
  'worldchain-mainnet': () => Promise.resolve(EVM_BULK_CHAINS['worldchain-mainnet']!),
  'sonic-mainnet': () => Promise.resolve(EVM_BULK_CHAINS['sonic-mainnet']!),
  'boba-mainnet': () => Promise.resolve(EVM_BULK_CHAINS['boba-mainnet']!),
  'zora-mainnet': () => Promise.resolve(EVM_BULK_CHAINS['zora-mainnet']!),
  'manta-pacific-mainnet': () => Promise.resolve(EVM_BULK_CHAINS['manta-pacific-mainnet']!),
  'taiko-mainnet': () => Promise.resolve(EVM_BULK_CHAINS['taiko-mainnet']!),
  'berachain-mainnet': () => Promise.resolve(EVM_BULK_CHAINS['berachain-mainnet']!),
  'abstract-mainnet': () => Promise.resolve(EVM_BULK_CHAINS['abstract-mainnet']!),
  'ink-mainnet': () => Promise.resolve(EVM_BULK_CHAINS['ink-mainnet']!),
  'unichain-mainnet': () => Promise.resolve(EVM_BULK_CHAINS['unichain-mainnet']!),
  'soneium-mainnet': () => Promise.resolve(EVM_BULK_CHAINS['soneium-mainnet']!),
  'holesky-testnet': () => Promise.resolve(EVM_BULK_CHAINS['holesky-testnet']!),
  'hoodi-testnet': () => Promise.resolve(EVM_BULK_CHAINS['hoodi-testnet']!),
  'optimism-sepolia-testnet': () => Promise.resolve(EVM_BULK_CHAINS['optimism-sepolia-testnet']!),
  'base-sepolia-testnet': () => Promise.resolve(EVM_BULK_CHAINS['base-sepolia-testnet']!),
  'arbitrum-sepolia-testnet': () => Promise.resolve(EVM_BULK_CHAINS['arbitrum-sepolia-testnet']!),
  'polygon-amoy-testnet': () => Promise.resolve(EVM_BULK_CHAINS['polygon-amoy-testnet']!),
  'avalanche-fuji-testnet': () => Promise.resolve(EVM_BULK_CHAINS['avalanche-fuji-testnet']!),
  'bsc-testnet': () => Promise.resolve(EVM_BULK_CHAINS['bsc-testnet']!),
  'linea-sepolia-testnet': () => Promise.resolve(EVM_BULK_CHAINS['linea-sepolia-testnet']!),
  'scroll-sepolia-testnet': () => Promise.resolve(EVM_BULK_CHAINS['scroll-sepolia-testnet']!),
  'zksync-sepolia-testnet': () => Promise.resolve(EVM_BULK_CHAINS['zksync-sepolia-testnet']!),
  'mantle-sepolia-testnet': () => Promise.resolve(EVM_BULK_CHAINS['mantle-sepolia-testnet']!),
  'blast-sepolia-testnet': () => Promise.resolve(EVM_BULK_CHAINS['blast-sepolia-testnet']!),
  'moonbase-alpha-testnet': () => Promise.resolve(EVM_BULK_CHAINS['moonbase-alpha-testnet']!),
} as const satisfies Partial<Record<ChainId, ChainLoader>>;

/**
 * The subset of ChainId values that have a registered loader in Phase 1 v1.0.
 * Use this as the parameter type for functions that need to load a chain;
 * solana-devnet is in the SolanaChainId union but is not (yet) in this set.
 */
export type SupportedChainId = keyof typeof CHAIN_LOADERS;

/** Type guard: returns true if `chainId` has a registered loader. */
export function isSupportedChainId(chainId: string): chainId is SupportedChainId {
  return chainId in CHAIN_LOADERS;
}

/**
 * Per-WDK registration tracker. WDK does not expose a public hasWallet
 * method we can rely on, so we track registrations externally with a
 * WeakMap so the wdk instance can be GC'd when the consumer drops it.
 */
const registeredChains = new WeakMap<WDK, Set<SupportedChainId>>();

/**
 * Ensures the given chain is registered with the WDK orchestrator.
 *
 * Idempotent. Returns immediately if `ensureChainRegistered(wdk, chainId)`
 * has already been called for this (wdk, chainId) pair. On first call,
 * lazy-loads the chain module (separate bundle chunk per chain per
 * F-BUNDLE-01) and calls wdk.registerWallet with the module default
 * export (the wallet manager class) and config.
 *
 * F-WDK-04 cast (`as never` on mod.default) is the documented mitigation for
 * pnpm not deduping @tetherto/wdk-wallet across the three wallet manager
 * packages, which makes TypeScript treat the private _seed fields of
 * WalletManagerEvm and WalletManagerSolana as nominally distinct types and
 * reject what is at runtime a valid registration. The cast is safe. The
 * WalletManager subclasses share their runtime shape because they share
 * the same @tetherto/wdk-wallet source code. Upstream fix proposed in
 * M1 v2 Appendix B item B.2: Tether moves @tetherto/wdk-wallet to
 * peerDependencies in the three wallet manager packages.
 *
 * See: ADR-008, PRD 02 Addendum 2.3, F-WDK-04.
 */
export async function ensureChainRegistered(
  wdk: WDK,
  chainId: SupportedChainId,
): Promise<void> {
  let chains = registeredChains.get(wdk);
  if (!chains) {
    chains = new Set<SupportedChainId>();
    registeredChains.set(wdk, chains);
  }
  if (chains.has(chainId)) return;

  const mod = await CHAIN_LOADERS[chainId]();
  // F-WDK-04 cast - see function-level JSDoc above.
  wdk.registerWallet(chainId, mod.default as never, mod.config as never);
  chains.add(chainId);
}