/**
 * Token registry — the headline Tether assets (USDt, XAUt) and their ERC-20
 * contract addresses per chain. Used to display token balances on the dashboard.
 * Adding a token is one entry here.
 */

export interface TokenInfo {
  readonly symbol: string;
  readonly address: string;
  readonly decimals: number;
}

const TOKENS: Record<string, readonly TokenInfo[]> = {
  ethereum: [
    { symbol: 'USDt', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
    { symbol: 'XAUt', address: '0x68749665FF8D2d112Fa859AA293F07A622782F38', decimals: 6 },
  ],
  'polygon-mainnet': [
    { symbol: 'USDt', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
  ],
  'arbitrum-mainnet': [
    { symbol: 'USDt', address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 },
  ],
  'optimism-mainnet': [
    { symbol: 'USDt', address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', decimals: 6 },
  ],
  'avalanche-mainnet': [
    { symbol: 'USDt', address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', decimals: 6 },
  ],
  'gnosis-mainnet': [
    { symbol: 'USDT', address: '0x4ECaBa5870353805a9F068101A40E0f32ed605C6', decimals: 6 },
  ],
  'bsc-mainnet': [
    { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
  ],
};

/** Returns the known tokens for a chain (empty if none configured). */
export function tokensFor(chain: string): readonly TokenInfo[] {
  return TOKENS[chain] ?? [];
}
