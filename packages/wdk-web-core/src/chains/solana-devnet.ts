/**
 * Solana devnet (cluster 'devnet').
 *
 * Public RPC: api.devnet.solana.com. Free testnet SOL from faucet.solana.com.
 * solana-devnet was in the SolanaChainId type union since v0.1 but its loader
 * was deferred to v1.1 (now landing as part of B1-2 bulk-add).
 *
 * Source: B1-2 bulk-add Solana extras.
 */

import WalletManagerSolana from '@tetherto/wdk-wallet-solana';
import type { ChainModuleMeta } from './types.js';

export default WalletManagerSolana;

export const config = {
  network: 'devnet',
  rpcUrl: 'https://api.devnet.solana.com',
} as const;

export const meta = {
  id: 'solana-devnet',
  family: 'solana',
  name: 'Solana Devnet',
  nativeCurrency: { symbol: 'SOL', decimals: 9 },
  testnet: true,
  bip44CoinType: 501,
  explorer: 'https://explorer.solana.com?cluster=devnet',
} as const satisfies ChainModuleMeta;