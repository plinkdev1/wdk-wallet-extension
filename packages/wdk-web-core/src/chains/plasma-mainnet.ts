/**
 * Plasma mainnet (EVM, chain ID 9745).
 *
 * Lazy-loaded via CHAIN_LOADERS (chains/index.ts) to keep cold-path bundle
 * light per F-BUNDLE-01.
 */
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';
import type { ChainModuleMeta } from './types.js';

export default WalletManagerEvm;

export const config = {
  rpcUrl: 'https://rpc.plasma.to',
  chainId: 9745,
} as const;

export const meta = {
  id: 'plasma-mainnet',
  family: 'evm',
  name: 'Plasma',
  nativeCurrency: { symbol: 'XPL', decimals: 18 },
  testnet: false,
  bip44CoinType: 60,
  explorer: 'https://explorer.plasma.to',
} as const satisfies ChainModuleMeta;