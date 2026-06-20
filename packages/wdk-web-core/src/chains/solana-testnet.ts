/**
 * Solana testnet (cluster 'testnet').
 *
 * Public RPC: api.testnet.solana.com. Used primarily by Solana validators
 * for canary releases; less commonly used than devnet by dApp developers.
 *
 * Source: B1-2 bulk-add Solana extras.
 */

import WalletManagerSolana from '@tetherto/wdk-wallet-solana';
import type { ChainModuleMeta } from './types.js';

export default WalletManagerSolana;

export const config = {
  network: 'testnet',
  rpcUrl: 'https://api.testnet.solana.com',
} as const;

export const meta = {
  id: 'solana-testnet',
  family: 'solana',
  name: 'Solana Testnet',
  nativeCurrency: { symbol: 'SOL', decimals: 9 },
  testnet: true,
  bip44CoinType: 501,
  explorer: 'https://explorer.solana.com?cluster=testnet',
} as const satisfies ChainModuleMeta;