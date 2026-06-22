/**
 * Polygon mainnet (chain ID 137).
 */
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';
import type { ChainModuleMeta } from './types.js';

export default WalletManagerEvm;

export const config = {
  // polygon-rpc.com deprecated public access (now 401); publicnode is a
  // CORS-enabled, no-key default. Override with a keyed endpoint via env.
  rpcUrl: 'https://polygon-bor-rpc.publicnode.com',
  chainId: 137,
} as const;

export const meta = {
  id: 'polygon-mainnet',
  family: 'evm',
  name: 'Polygon',
  nativeCurrency: { symbol: 'POL', decimals: 18 },
  testnet: false,
  bip44CoinType: 60,
  explorer: 'https://polygonscan.com',
} as const satisfies ChainModuleMeta;