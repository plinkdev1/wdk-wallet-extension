/**
 * defineEvmChain - factory for EVM chain modules.
 *
 * All EVM chains share the same WalletManagerEvm engine; only their config
 * (rpcUrl + chainId) and display meta differ. This factory captures that
 * pattern so the chains/_evm-bulk-chains.ts registry can be a dense list of
 * one-line entries instead of N files of identical boilerplate.
 *
 * Per-file chain modules (ethereum.ts, sepolia.ts, plasma-*.ts, polygon.ts,
 * arbitrum.ts) are unchanged - they predate this factory and we keep them
 * as-is to avoid disturbing the existing CHAIN_LOADERS shape. New chains
 * land via the factory + bulk registry.
 *
 * Source: B1-2 EVM bulk-add.
 */

import WalletManagerEvm from '@tetherto/wdk-wallet-evm';
import type { EvmChainId } from '../types/chains.js';
import type { ChainModuleMeta } from './types.js';

export interface EvmChainSpec {
  readonly id: EvmChainId;
  readonly chainId: number;
  readonly rpcUrl: string;
  readonly name: string;
  readonly testnet: boolean;
  readonly explorer?: string;
  /** Defaults to { symbol: 'ETH', decimals: 18 } when omitted. */
  readonly nativeCurrency?: {
    readonly symbol: string;
    readonly decimals: number;
  };
}

export interface DefinedEvmChain {
  readonly default: typeof WalletManagerEvm;
  readonly config: {
    readonly rpcUrl: string;
    readonly chainId: number;
  };
  readonly meta: ChainModuleMeta;
}

export function defineEvmChain(spec: EvmChainSpec): DefinedEvmChain {
  return {
    default: WalletManagerEvm,
    config: {
      rpcUrl: spec.rpcUrl,
      chainId: spec.chainId,
    },
    meta: {
      id: spec.id,
      family: 'evm',
      name: spec.name,
      nativeCurrency: spec.nativeCurrency ?? { symbol: 'ETH', decimals: 18 },
      testnet: spec.testnet,
      bip44CoinType: 60,
      // exactOptionalPropertyTypes: true forbids assigning `undefined` to
      // an optional `?: string` property - conditional spread keeps the
      // property absent when spec.explorer is undefined instead.
      ...(spec.explorer !== undefined ? { explorer: spec.explorer } : {}),
    },
  };
}