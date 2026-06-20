import type { ChainFamily, ChainId } from '../types/chains.js';

/**
 * Display metadata for a chain module. Each chain module exports a `meta`
 * object satisfying this shape.
 *
 * `meta` is distinct from `config`: config carries runtime parameters
 * (RPC URL, chain ID) that WDK consumes; meta carries presentation data
 * (name, currency symbol, explorer URL) that the UI consumes.
 */
export interface ChainModuleMeta {
  readonly id: ChainId;
  readonly family: ChainFamily;
  readonly name: string;
  readonly nativeCurrency: {
    readonly symbol: string;
    readonly decimals: number;
  };
  readonly testnet: boolean;
  readonly bip44CoinType: number;
  readonly explorer?: string;
}