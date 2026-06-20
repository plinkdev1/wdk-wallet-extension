/**
 * Block-explorer base URLs per chain, for linking transactions and addresses.
 * Only chains with a known explorer are listed; others return null (no link).
 */
const EXPLORERS: Record<string, string> = {
  ethereum: 'https://etherscan.io',
  'polygon-mainnet': 'https://polygonscan.com',
  'arbitrum-mainnet': 'https://arbiscan.io',
  'optimism-mainnet': 'https://optimistic.etherscan.io',
  'base-mainnet': 'https://basescan.org',
  'bsc-mainnet': 'https://bscscan.com',
  'avalanche-mainnet': 'https://snowtrace.io',
  'gnosis-mainnet': 'https://gnosisscan.io',
  'plasma-mainnet': 'https://explorer.plasma.to',
  'linea-mainnet': 'https://lineascan.build',
  'scroll-mainnet': 'https://scrollscan.com',
  'zksync-mainnet': 'https://explorer.zksync.io',
  'mantle-mainnet': 'https://explorer.mantle.xyz',
  'celo-mainnet': 'https://celoscan.io',
  // testnets
  'sepolia-testnet': 'https://sepolia.etherscan.io',
  'holesky-testnet': 'https://holesky.etherscan.io',
  'plasma-testnet': 'https://testnet.plasmascan.to',
  'base-sepolia-testnet': 'https://sepolia.basescan.org',
  'arbitrum-sepolia-testnet': 'https://sepolia.arbiscan.io',
  'optimism-sepolia-testnet': 'https://sepolia-optimism.etherscan.io',
  'polygon-amoy-testnet': 'https://amoy.polygonscan.com',
};

/** Returns the explorer base URL for a chain, or null if unknown. */
export function explorerBase(chain: string): string | null {
  return EXPLORERS[chain] ?? null;
}

/** Returns a transaction URL on the chain's explorer, or null if unknown. */
export function explorerTxUrl(chain: string, hash: string): string | null {
  const base = explorerBase(chain);
  return base ? `${base}/tx/${hash}` : null;
}
