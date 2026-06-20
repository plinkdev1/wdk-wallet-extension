import WalletManagerBtc from '@tetherto/wdk-wallet-btc';
import type { ChainModuleMeta } from './types.js';

export default WalletManagerBtc;

/**
 * BIP-84 native-segwit (P2WPKH) on Bitcoin mainnet. Uses the Blockbook HTTP
 * transport (browser-safe; Electrum is TCP and not bundleable) so balance and
 * send work in the extension. Override the URL with your own Blockbook instance
 * for production. See docs/ROADMAP.md.
 */
export const config = {
  network: 'bitcoin',
  bip: 84,
  client: { type: 'blockbook-http', clientConfig: { url: 'https://btc1.trezor.io/api' } },
} as const;

export const meta = {
  id: 'bitcoin-mainnet',
  family: 'bitcoin',
  name: 'Bitcoin',
  nativeCurrency: { symbol: 'BTC', decimals: 8 },
  testnet: false,
  bip44CoinType: 0,
  explorer: 'https://mempool.space',
} as const satisfies ChainModuleMeta;
