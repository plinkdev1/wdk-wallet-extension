import WalletManagerTron from '@tetherto/wdk-wallet-tron';
import type { ChainModuleMeta } from './types.js';

export default WalletManagerTron;

/**
 * Tron — accounts via @tetherto/wdk-wallet-tron. Uses the public TronGrid
 * full-node provider; set your own for production rate limits.
 * See docs/ROADMAP.md (Phase 3).
 */
export const config = {
  provider: 'https://api.trongrid.io',
} as const;

export const meta = {
  id: 'tron-mainnet',
  family: 'tron',
  name: 'Tron',
  nativeCurrency: { symbol: 'TRX', decimals: 6 },
  testnet: false,
  bip44CoinType: 195,
  explorer: 'https://tronscan.org',
} as const satisfies ChainModuleMeta;
