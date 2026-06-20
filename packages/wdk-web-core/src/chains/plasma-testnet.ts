/**
 * Plasma testnet (EVM, chain ID 9746).
 *
 * Phase 0 validation target. testnet-rpc.plasma.to was confirmed reachable
 * in Test 02 (getBalance returned 0 wei against a derived address).
 */
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';
import type { ChainModuleMeta } from './types.js';

export default WalletManagerEvm;

export const config = {
  rpcUrl: 'https://testnet-rpc.plasma.to',
  chainId: 9746,
} as const;

export const meta = {
  id: 'plasma-testnet',
  family: 'evm',
  name: 'Plasma Testnet',
  nativeCurrency: { symbol: 'XPL', decimals: 18 },
  testnet: true,
  bip44CoinType: 60,
  explorer: 'https://testnet-explorer.plasma.to',
} as const satisfies ChainModuleMeta;