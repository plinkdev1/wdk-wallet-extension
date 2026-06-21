/**
 * @wdk-starter/wdk-web-core/chains/registry
 *
 * Per-consumer chain-registry factory (B-12 / ADR-012). Builds a chain
 * registry from an EXPLICIT set of already-imported chain modules. Because the
 * modules are passed in rather than imported here, a consumer that calls this
 * with only the chains it ships lets the bundler tree-shake every other chain
 * out of its bundle — the B-12 service-worker slimming path.
 *
 * The MV3 service worker cannot use dynamic import() (F-MV3-04), so chain
 * modules are still *statically* imported by the consumer — but the consumer
 * now controls WHICH ones. A Plasma-only build no longer carries Solana,
 * Bitcoin, TON, Tron, and ~50 EVM chains it never registers.
 *
 * chains/index.ts composes the full, batteries-included registry from this
 * factory (every supported chain). Consumers that don't care about bundle size
 * keep importing from chains/index.ts exactly as before — this module changes
 * nothing for them.
 *
 * See: ADR-012 (per-consumer registry), ADR-008 (registration), F-WDK-04 (cast),
 * F-SEC-01 (hasOwnProperty whitelist guard), F-MV3-04 (no dynamic import in SW).
 */

import type WDK from '@tetherto/wdk';
import type { ChainId } from '../types/chains.js';
import type { ChainModuleMeta } from './types.js';

export type { ChainModuleMeta } from './types.js';

/**
 * The runtime shape every chain module exports: `default` (the wallet manager
 * class WDK registers), `config` (runtime params WDK consumes), and `meta`
 * (display metadata the UI consumes).
 */
export interface ChainModule {
  readonly default: unknown;
  readonly config: Record<string, unknown>;
  readonly meta: ChainModuleMeta;
}

/**
 * A chain loader is a thunk that resolves a chain module. The async signature
 * is preserved for API stability even though the full registry resolves
 * already-imported modules synchronously (F-MV3-04 forbids dynamic import in
 * the MV3 SW, so there is nothing to await there).
 */
export type ChainLoader = () => Promise<ChainModule>;

/** A composed registry: the loader map plus the helpers bound to it. */
export interface ChainRegistry<K extends ChainId> {
  /** Registry of chain loaders, keyed by chain id. */
  readonly CHAIN_LOADERS: Readonly<Record<K, ChainLoader>>;
  /** Type guard: true if `chainId` has a registered loader in THIS registry. */
  isSupportedChainId(chainId: string): chainId is K;
  /** Idempotently registers a chain with the WDK orchestrator. */
  ensureChainRegistered(wdk: WDK, chainId: K): Promise<void>;
}

/**
 * Builds a {@link ChainRegistry} from an explicit map of chain modules.
 *
 * @example Slim, bundle-conscious consumer (only the chains it ships):
 *   import { createChainRegistry } from '@wdk-starter/wdk-web-core/chains/registry';
 *   import * as ethereum      from '@wdk-starter/wdk-web-core/chains/ethereum';
 *   import * as plasmaMainnet from '@wdk-starter/wdk-web-core/chains/plasma-mainnet';
 *   const { CHAIN_LOADERS, ensureChainRegistered, isSupportedChainId } =
 *     createChainRegistry({ ethereum, 'plasma-mainnet': plasmaMainnet });
 *   // every other chain is tree-shaken out of this bundle.
 */
export function createChainRegistry<K extends ChainId>(
  modules: Readonly<Record<K, ChainModule>>,
): ChainRegistry<K> {
  const CHAIN_LOADERS = {} as Record<K, ChainLoader>;
  for (const id of Object.keys(modules) as K[]) {
    CHAIN_LOADERS[id] = () => Promise.resolve(modules[id]);
  }

  /**
   * F-SEC-01: use hasOwnProperty, not the `in` operator, so a chain id that
   * collides with an Object.prototype member (e.g. 'toString') can never be
   * mistaken for a registered chain.
   */
  function isSupportedChainId(chainId: string): chainId is K {
    return Object.prototype.hasOwnProperty.call(CHAIN_LOADERS, chainId);
  }

  /**
   * Per-WDK registration tracker. WDK exposes no reliable `hasWallet`, so we
   * track registrations externally with a WeakMap so the wdk instance can be
   * GC'd when the consumer drops it.
   */
  const registeredChains = new WeakMap<WDK, Set<K>>();

  /**
   * Ensures the given chain is registered with the WDK orchestrator. Idempotent
   * per (wdk, chainId). The F-WDK-04 cast (`as never` on `mod.default`) is the
   * documented mitigation for pnpm not deduping @tetherto/wdk-wallet across the
   * wallet-manager packages, which makes TS treat their private `_seed` fields
   * as nominally distinct and reject a registration that is valid at runtime.
   * See: ADR-008, PRD 02 Addendum 2.3, F-WDK-04.
   */
  async function ensureChainRegistered(wdk: WDK, chainId: K): Promise<void> {
    let chains = registeredChains.get(wdk);
    if (!chains) {
      chains = new Set<K>();
      registeredChains.set(wdk, chains);
    }
    if (chains.has(chainId)) return;

    const mod = await CHAIN_LOADERS[chainId]();
    wdk.registerWallet(chainId, mod.default as never, mod.config as never);
    chains.add(chainId);
  }

  return { CHAIN_LOADERS, isSupportedChainId, ensureChainRegistered };
}
