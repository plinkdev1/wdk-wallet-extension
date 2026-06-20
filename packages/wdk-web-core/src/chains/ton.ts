import WalletManagerTon from '@tetherto/wdk-wallet-ton';
import type { ChainModuleMeta } from './types.js';

export default WalletManagerTon;

/**
 * TON (The Open Network) — v5r1 wallet accounts via @tetherto/wdk-wallet-ton.
 * Uses the public TonCenter JSON-RPC endpoint; set TON_API_KEY / your own
 * endpoint for production rate limits. See docs/ROADMAP.md (Phase 3).
 */
export const config = {
  tonClient: { endpoint: 'https://toncenter.com/api/v2/jsonRPC' },
} as const;

export const meta = {
  id: 'ton-mainnet',
  family: 'ton',
  name: 'TON',
  nativeCurrency: { symbol: 'TON', decimals: 9 },
  testnet: false,
  bip44CoinType: 607,
  explorer: 'https://tonviewer.com',
} as const satisfies ChainModuleMeta;
