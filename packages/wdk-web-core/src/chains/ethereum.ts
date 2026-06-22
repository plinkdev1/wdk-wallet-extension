/**
 * Ethereum mainnet (chain ID 1).
 *
 * Default public RPC; product consumers should override with an authenticated
 * endpoint (Alchemy, Infura, etc.) for production.
 */
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';
import type { ChainModuleMeta } from './types.js';

export default WalletManagerEvm;

export const config = {
  // CORS-enabled, no-key public default (works in a browser out of the box).
  // Override with an authenticated endpoint via the adapter's `rpcUrls`/env.
  rpcUrl: 'https://ethereum-rpc.publicnode.com',
  chainId: 1,
} as const;

export const meta = {
  id: 'ethereum',
  family: 'evm',
  name: 'Ethereum',
  nativeCurrency: { symbol: 'ETH', decimals: 18 },
  testnet: false,
  bip44CoinType: 60,
  explorer: 'https://etherscan.io',
} as const satisfies ChainModuleMeta;