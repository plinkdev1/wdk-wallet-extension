/**
 * Arbitrum One (chain ID 42161).
 */
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';
import type { ChainModuleMeta } from './types.js';

export default WalletManagerEvm;

export const config = {
  rpcUrl: 'https://arb1.arbitrum.io/rpc',
  chainId: 42161,
} as const;

export const meta = {
  id: 'arbitrum-mainnet',
  family: 'evm',
  name: 'Arbitrum One',
  nativeCurrency: { symbol: 'ETH', decimals: 18 },
  testnet: false,
  bip44CoinType: 60,
  explorer: 'https://arbiscan.io',
} as const satisfies ChainModuleMeta;