/**
 * Solana mainnet (network 'mainnet-beta').
 *
 * Per F-BUNDLE-01: Solana adds ~99 modules / +81 KB gzipped over the
 * EVM-only baseline. Lazy-loaded via CHAIN_LOADERS so users on Plasma-only
 * never download this code.
 *
 * The F-WDK-04 'as never' cast is applied at the central dispatch site
 * (chains/index.ts ensureChainRegistered), not here at the export. Keeps
 * the cast localized to one comment-able location instead of scattered
 * across the chain modules.
 *
 * solana-devnet is in the SolanaChainId type union but is not shipped with
 * a loader in Phase 1 v1.0; deferred to v1.1.
 */
import WalletManagerSolana from '@tetherto/wdk-wallet-solana';
import type { ChainModuleMeta } from './types.js';

export default WalletManagerSolana;

export const config = {
  network: 'mainnet-beta',
  rpcUrl: 'https://api.mainnet-beta.solana.com',
} as const;

export const meta = {
  id: 'solana-mainnet',
  family: 'solana',
  name: 'Solana',
  nativeCurrency: { symbol: 'SOL', decimals: 9 },
  testnet: false,
  bip44CoinType: 501,
  explorer: 'https://explorer.solana.com',
} as const satisfies ChainModuleMeta;