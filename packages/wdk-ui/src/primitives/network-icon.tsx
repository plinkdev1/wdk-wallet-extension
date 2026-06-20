/**
 * NetworkIcon - chain logo rendered from @web3icons/react/dynamic.
 *
 * v0.1 used static per-chain imports (NetworkEthereum) with an if-chain
 * branching on the chain prop. That works for one chain. For 51 it doesn't,
 * so this commit moves to the dynamic entry point which lazy-loads icons
 * at runtime by network slug.
 *
 * The chain id -> web3icons-slug map below is the only thing that needs
 * extending when registering a new chain. Slugs are the id field from
 * web3icons networks.json; testnets reuse the mainnet slug since the
 * library doesn't differentiate (the testnet logo IS the mainnet logo).
 *
 * For chains the library doesn't have (e.g. plasma), the dynamic component
 * fallback prop renders a colored chip with the first two letters of the
 * chain id and a stable hashed-to-hue background. Better than empty space.
 */

import type { CSSProperties, ReactNode } from 'react';
import { NetworkIcon as DynamicNetworkIcon } from '@web3icons/react/dynamic';

// Chain id -> web3icons network slug. See networks.json in the library.
const CHAIN_TO_WEB3ICON_SLUG: Readonly<Record<string, string>> = {
  'ethereum': 'ethereum',
  'plasma-mainnet': 'plasma',
  'polygon-mainnet': 'polygon',
  'arbitrum-mainnet': 'arbitrum',
  'optimism-mainnet': 'optimism',
  'base-mainnet': 'base',
  'bsc-mainnet': 'binance-smart-chain',
  'avalanche-mainnet': 'avalanche',
  'gnosis-mainnet': 'gnosis',
  'celo-mainnet': 'celo',
  'moonbeam-mainnet': 'moonbeam',
  'moonriver-mainnet': 'moonriver',
  'cronos-mainnet': 'cronos',
  'linea-mainnet': 'linea',
  'scroll-mainnet': 'scroll',
  'zksync-mainnet': 'zksync-era',
  'polygon-zkevm-mainnet': 'polygon-zkevm',
  'mantle-mainnet': 'mantle',
  'blast-mainnet': 'blast',
  'mode-mainnet': 'mode',
  'metis-mainnet': 'metis',
  'worldchain-mainnet': 'worldcoin',
  'sonic-mainnet': 'sonic',
  'boba-mainnet': 'boba',
  'zora-mainnet': 'zora',
  'manta-pacific-mainnet': 'manta',
  'taiko-mainnet': 'taiko',
  'berachain-mainnet': 'berachain',
  'abstract-mainnet': 'abstract',
  'ink-mainnet': 'ink',
  'unichain-mainnet': 'unichain',
  'soneium-mainnet': 'soneium',
  'sepolia-testnet': 'ethereum',
  'plasma-testnet': 'plasma',
  'holesky-testnet': 'ethereum',
  'hoodi-testnet': 'ethereum',
  'optimism-sepolia-testnet': 'optimism',
  'base-sepolia-testnet': 'base',
  'arbitrum-sepolia-testnet': 'arbitrum',
  'polygon-amoy-testnet': 'polygon',
  'avalanche-fuji-testnet': 'avalanche',
  'bsc-testnet': 'binance-smart-chain',
  'linea-sepolia-testnet': 'linea',
  'scroll-sepolia-testnet': 'scroll',
  'zksync-sepolia-testnet': 'zksync-era',
  'mantle-sepolia-testnet': 'mantle',
  'blast-sepolia-testnet': 'blast',
  'moonbase-alpha-testnet': 'moonbeam',
  'solana-mainnet': 'solana',
  'solana-devnet': 'solana',
  'solana-testnet': 'solana',
};

export interface NetworkIconProps {
  /** Chain identifier (any string; unrecognized falls back to chip). */
  readonly chain: string;
  /** Render size in px. Default 16. */
  readonly size?: number;
  /** branded / mono / background. Default branded. */
  readonly variant?: 'mono' | 'branded' | 'background';
  /** Color override; applies to mono variant. */
  readonly color?: string;
}

function ChipFallback({ chain, size }: { chain: string; size: number }): JSX.Element {
  // Hash the chain id to a stable hue 0-360.
  let h = 0;
  for (let i = 0; i < chain.length; i++) h = (h + chain.charCodeAt(i) * 31) % 360;
  const initials = chain.replace(/^solana-/, 'sol-').split('-')[0]!.slice(0, 2).toUpperCase();
  const style: CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    background: `hsl(${h}, 55%, 42%)`,
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: Math.max(8, Math.floor(size * 0.5)),
    fontWeight: 600,
    lineHeight: 1,
    verticalAlign: 'middle',
    fontFamily: 'var(--font-mono, monospace)',
  };
  return (
    <span aria-hidden="true" style={style}>
      {initials}
    </span>
  );
}

export function NetworkIcon({
  chain,
  size = 16,
  variant = 'branded',
  color,
}: NetworkIconProps): JSX.Element {
  const slug = CHAIN_TO_WEB3ICON_SLUG[chain] ?? chain;
  const fallback: ReactNode = <ChipFallback chain={chain} size={size} />;
  return color !== undefined
    ? <DynamicNetworkIcon name={slug} size={size} variant={variant} color={color} fallback={fallback} />
    : <DynamicNetworkIcon name={slug} size={size} variant={variant} fallback={fallback} />;
}