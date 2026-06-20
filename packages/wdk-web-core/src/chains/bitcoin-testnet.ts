import WalletManagerBtc from '@tetherto/wdk-wallet-btc';
import type { ChainModuleMeta } from './types.js';

export default WalletManagerBtc;

/** BIP-84 native-segwit (P2WPKH) on Bitcoin testnet. See bitcoin-mainnet.ts. */
export const config = {
  network: 'testnet',
  bip: 84,
  client: { type: 'blockbook-http', clientConfig: { url: 'https://tbtc1.trezor.io/api' } },
} as const;

export const meta = {
  id: 'bitcoin-testnet',
  family: 'bitcoin',
  name: 'Bitcoin Testnet',
  nativeCurrency: { symbol: 'tBTC', decimals: 8 },
  testnet: true,
  bip44CoinType: 1,
  explorer: 'https://mempool.space/testnet',
} as const satisfies ChainModuleMeta;
