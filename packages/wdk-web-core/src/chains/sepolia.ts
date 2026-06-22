/**
 * Sepolia testnet (EVM, chain ID 11155111).
 *
 * Ethereum's primary testnet as of 2024+. PoS consensus, free testnet ETH
 * from public faucets, target for most dApp testnet deployments and L2
 * staging environments.
 *
 * Default RPC: PublicNode's CORS-enabled, no-key Sepolia gateway. Product
 * consumers should override with an authenticated endpoint for production-
 * grade reliability.
 *
 * Source: B1 chain registry expansion. Naming follows the
 * <chain>-testnet convention from types/chains.ts.
 */
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';
import type { ChainModuleMeta } from './types.js';

export default WalletManagerEvm;

export const config = {
  rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
  chainId: 11155111,
} as const;

export const meta = {
  id: 'sepolia-testnet',
  family: 'evm',
  name: 'Sepolia',
  nativeCurrency: { symbol: 'ETH', decimals: 18 },
  testnet: true,
  bip44CoinType: 60,
  explorer: 'https://sepolia.etherscan.io',
} as const satisfies ChainModuleMeta;