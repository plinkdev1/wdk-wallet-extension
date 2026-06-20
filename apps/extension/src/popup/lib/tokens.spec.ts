import { describe, it, expect } from 'vitest';
import { tokensFor } from './tokens.js';

describe('token registry', () => {
  it('exposes USDt and XAUt on Ethereum with correct decimals', () => {
    const tokens = tokensFor('ethereum');
    const symbols = tokens.map((t) => t.symbol);
    expect(symbols).toContain('USDt');
    expect(symbols).toContain('XAUt');
    expect(tokens.find((t) => t.symbol === 'USDt')?.decimals).toBe(6);
  });

  it('exposes USDt on the major L2s', () => {
    for (const chain of ['polygon-mainnet', 'arbitrum-mainnet', 'optimism-mainnet']) {
      expect(tokensFor(chain).some((t) => t.symbol === 'USDt')).toBe(true);
    }
  });

  it('returns an empty list for chains with no configured tokens', () => {
    expect(tokensFor('solana-mainnet')).toEqual([]);
    expect(tokensFor('unknown-chain')).toEqual([]);
  });
});
